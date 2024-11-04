'use client'
import { useState, useEffect, useCallback } from 'react';
import { collection, addDoc, query, onSnapshot, deleteDoc, doc, updateDoc, where, Firestore } from 'firebase/firestore';
import { db } from '../firebase';
import { PlusIcon, TrashIcon, ArrowDownTrayIcon } from "@heroicons/react/16/solid";
import { useAuth } from "../authcontext";
import { useRouter } from "next/navigation";
import { CameraComp } from "../CameraComp";
import { run } from "../genai/app";
import * as XLSX from 'xlsx';
import Image from 'next/image';

interface ReceiptItem {
  HealthSpendingAccountEligible: boolean;
  name?: string;
  price?: number;
}

interface Expense {
  id?: string;
  date: string;
  merchant: string;
  itemName: string;
  price: number;
  tax: number;
  totalPrice: number;
  hsaEligible: boolean;
}

interface ExcelDataRow {
  Date: string;
  Merchant: string;
  'Item Name': string;
  Price: number | string;
  Tax: number | string;
  'Total Price': number;
}

// Add this type to handle Firebase document updates
type FirestoreExpense = {
  date: string;
  merchant: string;
  itemName: string;
  price: number;
  tax: number;
  totalPrice: number;
  hsaEligible: boolean;
  userId: string;
  createdAt: Date;
};

export default function ExpensesPage() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [newExpense, setNewExpense] = useState<Expense>({
    date: '',
    merchant: '',
    itemName: '',
    price: 0,
    tax: 0,
    totalPrice: 0,
    hsaEligible: false
  });
  const [image, setImage] = useState('');
  const [displayImage, setDisplayImage] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [selectedTaxYear, setSelectedTaxYear] = useState<string>('');
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [isUploadedImage, setIsUploadedImage] = useState(false);
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  const formatDate = useCallback((date: Date) => {
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  }, []);

  useEffect(() => {
    if (!user || !db) {
      console.log("No user or db in ExpensesPage, redirecting to home");
      router.push('/');
      return;
    }

    console.log("User in ExpensesPage:", user);

    const q = query(
      collection(db as Firestore, 'expenses'),
      where('userId', '==', user.uid)
    );
    
    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const expensesArr = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Expense[];
      setExpenses(expensesArr);
    });

    return () => unsubscribe();
  }, [user, router]);

  const addExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !db) return;

    try {
      await addDoc(collection(db as Firestore, 'expenses'), {
        ...newExpense,
        date: formatDate(new Date(newExpense.date)),
        userId: user.uid,
        createdAt: new Date()
      });
      setNewExpense({
        date: '',
        merchant: '',
        itemName: '',
        price: 0,
        tax: 0,
        totalPrice: 0,
        hsaEligible: false
      });
      setImage('');
    } catch (error) {
      console.error("Error adding expense: ", error);
    }
  };

  const deleteExpense = async (id: string) => {
    if (!db) return;
    await deleteDoc(doc(db as Firestore, 'expenses', id));
  };

  const updateExpense = async (id: string, updatedExpense: Expense) => {
    if (!user || !db) return;
    
    const updateData: Partial<FirestoreExpense> = {
      date: formatDate(new Date(updatedExpense.date)),
      merchant: updatedExpense.merchant,
      itemName: updatedExpense.itemName,
      price: updatedExpense.price,
      tax: updatedExpense.tax,
      totalPrice: updatedExpense.totalPrice,
      hsaEligible: updatedExpense.hsaEligible,
    };

    await updateDoc(doc(db as Firestore, 'expenses', id), updateData);
  };

  const handleImageCapture = useCallback(async (imageData: string) => {
    if (!imageData || !db || !user) return;

    setAnalysisError(null);
    try {
      const result = await run(imageData, process.env.NEXT_PUBLIC_GEMINI_API_KEY);
      
      let parsedResult;
      try {
        parsedResult = JSON.parse(result.response.text());
      } catch (parseError) {
        console.error("Error parsing JSON:", parseError);
        const cleanedJsonString = result.response.text().replace(/\n/g, '').replace(/\r/g, '').trim();
        try {
          parsedResult = JSON.parse(cleanedJsonString);
        } catch (secondParseError) {
          console.error("Error parsing cleaned JSON:", secondParseError);
          setAnalysisError("Unable to parse the receipt data. Please try again.");
          return;
        }
      }
      
      if (!parsedResult.items || !Array.isArray(parsedResult.items)) {
        setAnalysisError("Invalid receipt data format. Please try again.");
        return;
      }
      
      const taxRate = parseFloat(parsedResult.taxRate) / 100;
      const hsaEligibleItems = parsedResult.items.filter((item: ReceiptItem) => item.HealthSpendingAccountEligible);
      
      if (hsaEligibleItems.length > 0) {
        for (const item of hsaEligibleItems) {
          const price = parseFloat(item.price);
          const tax = Number((price * taxRate).toFixed(2));
          const totalPrice = Number((price + tax).toFixed(2));
          
          await addDoc(collection(db as Firestore, 'expenses'), {
            date: formatDate(new Date(parsedResult.date)),
            merchant: parsedResult.merchant,
            itemName: item.name,
            price: price,
            tax: tax,
            totalPrice: totalPrice,
            hsaEligible: item.HealthSpendingAccountEligible,
            userId: user.uid,
            createdAt: new Date()
          });
        }
        setNewExpense({
          date: '',
          merchant: '',
          itemName: '',
          price: 0,
          tax: 0,
          totalPrice: 0,
          hsaEligible: false
        });
        setImage('');
      } else {
        setAnalysisError("No HSA-eligible items found in the receipt.");
      }
      
    } catch (error) {
      console.error("Error analyzing image:", error);
      setAnalysisError("An error occurred while analyzing the image. Please try again.");
    }
  }, [formatDate, user, setImage]);

  const handleLogout = async () => {
    try {
      await logout();
      router.push('/');
    } catch (error) {
      console.error("Error logging out:", error);
    }
  };

  const toggleEdit = (expense: Expense) => {
    if (editingExpense && editingExpense.id === expense.id) {
      // Save the edited expense
      updateExpense(expense.id!, editingExpense);
      setEditingExpense(null);
    } else {
      // Start editing
      setEditingExpense(expense);
    }
  };

  const handleEditChange = (field: keyof Expense, value: string | number) => {
    if (editingExpense) {
      setEditingExpense({ ...editingExpense, [field]: value });
    }
  };

  // Add this new function to get unique tax years from expenses
  const getUniqueTaxYears = () => {
    const years = expenses.map(expense => new Date(expense.date).getFullYear());
    return Array.from(new Set(years)).sort((a, b) => b - a); // Sort in descending order
  };

  // Define filteredExpenses before using it in calculateTotalForSelectedYear
  const filteredExpenses = expenses.filter(expense => {
    const expenseYear = new Date(expense.date).getFullYear().toString();
    const matchesSearch = 
      expense.merchant.toLowerCase().includes(searchQuery.toLowerCase()) ||
      expense.date.includes(searchQuery) ||
      expense.itemName.toLowerCase().includes(searchQuery.toLowerCase());
    
    return (selectedTaxYear === '' || expenseYear === selectedTaxYear) && matchesSearch;
  });

  const calculateTotalForSelectedYear = useCallback((year: number) => {
    return filteredExpenses.reduce((total, expense) => total + expense.totalPrice, 0).toFixed(2);
  }, [filteredExpenses]);

  // Add this new function to generate and download Excel
  const exportToExcel = useCallback(() => {
    const year = selectedTaxYear || 'All Years';
    const filename = `HSA_Expenses_${year}.xlsx`;
    
    const data: ExcelDataRow[] = filteredExpenses.map(expense => ({
      Date: formatDate(new Date(expense.date)),
      Merchant: expense.merchant,
      'Item Name': expense.itemName,
      Price: expense.price,
      Tax: expense.tax,
      'Total Price': expense.totalPrice
    }));

    const total = calculateTotalForSelectedYear(parseInt(selectedTaxYear) || new Date().getFullYear());
    data.push({
      Date: '',
      Merchant: '',
      'Item Name': 'Total',
      Price: 0,
      Tax: 0,
      'Total Price': parseFloat(total)
    });

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(data);
    XLSX.utils.book_append_sheet(wb, ws, "HSA Expenses");
    XLSX.writeFile(wb, filename);
  }, [filteredExpenses, selectedTaxYear, calculateTotalForSelectedYear, formatDate]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setImage(reader.result as string);
        setIsUploadedImage(true);
        setAnalysisError(null); // Clear error message
      };
      reader.readAsDataURL(file);
    }
  };

  const handleCameraClose = useCallback(() => {
    setIsCameraActive(false);
    setImage('');
    setAnalysisError(null); // Clear error message
  }, []);

  const handleAnalyzeClick = useCallback(() => {
    if (image) {
      handleImageCapture(image);
    }
  }, [image, handleImageCapture]);

  return isClient ? (
    <main className="flex min-h-screen flex-col items-center justify-between sm:p-8 p-4">
      <div className="z-10 w-full max-w-7xl items-center justify-between font-mono text-sm">
        <div className="flex justify-between items-center mb-4">
          <h1 className="text-4xl p-4">HSA Expense Tracker</h1>
          <button
            onClick={handleLogout}
            className="relative bg-slate-950 text-white p-3 rounded-lg hover:bg-slate-900 border-2 border-transparent hover:border-slate-200 flex items-center justify-center transition-all duration-300"
          >
            <span className="mr-2">Logout</span>
            <span className="absolute inset-0 border-2 border-slate-200 rounded-lg pointer-events-none"></span>
          </button>
        </div>
        <div className="bg-slate-800 p-6 rounded-lg">
          <form onSubmit={addExpense} className="grid grid-cols-7 gap-x-2 gap-y-4 items-center text-black mb-4">
            <div className="col-span-1 text-white text-center">Date</div>
            <div className="col-span-1 text-white text-center">Merchant</div>
            <div className="col-span-2 text-white text-center">Item Name</div>
            <div className="col-span-1 text-white text-center">Price</div>
            <div className="col-span-1 text-white text-center">Tax</div>
            <div className="col-span-1 text-white text-center">Total Price</div>
            
            <input
              value={newExpense.date}
              onChange={(e) => setNewExpense({ ...newExpense, date: e.target.value })}
              className="col-span-1 p-2 border rounded-lg" type="date" required
            />
            <input
              value={newExpense.merchant}
              onChange={(e) => setNewExpense({ ...newExpense, merchant: e.target.value })}
              className="col-span-1 p-2 border rounded-lg" type="text" placeholder="Merchant" required
            />
            <input
              value={newExpense.itemName}
              onChange={(e) => setNewExpense({ ...newExpense, itemName: e.target.value })}
              className="col-span-2 p-2 border rounded-lg" type="text" placeholder="Item Name" required
            />
            <input
              value={newExpense.price}
              onChange={(e) => setNewExpense({ ...newExpense, price: parseFloat(e.target.value) })}
              className="col-span-1 p-2 border rounded-lg" type="number" step="0.01" placeholder="Price" required
            />
            <input
              value={newExpense.tax}
              onChange={(e) => setNewExpense({ ...newExpense, tax: parseFloat(e.target.value) })}
              className="col-span-1 p-2 border rounded-lg" type="number" step="0.01" placeholder="Tax" required
            />
            <input
              value={newExpense.totalPrice}
              onChange={(e) => setNewExpense({ ...newExpense, totalPrice: parseFloat(e.target.value) })}
              className="col-span-1 p-2 border rounded-lg" type="number" step="0.01" placeholder="Total Price" required
            />
            <button
              className="col-span-7 text-white bg-slate-950 rounded-lg hover:bg-slate-900 p-2 text-xl"
              type="submit"
            >
              <PlusIcon className="h-6 w-6 mr-1 inline" />
              Add Expense
            </button>
          </form>
          <div className="flex-col items-center justify-between p-4 w-full max-w-2xl">
            {isCameraActive ? (
              <div className="mb-4">
                <CameraComp 
                  image={image} 
                  setImage={setImage}
                  setDisplayImage={setDisplayImage}
                  onClose={handleCameraClose}
                  onAnalyze={handleAnalyzeClick}
                />
              </div>
            ) : (
              <div className="flex justify-center space-x-4 mb-4">
                <button 
                  className="bg-blue-600 p-2 rounded-md"
                  onClick={() => {
                    setIsCameraActive(true);
                    setAnalysisError(null); // Clear error message
                  }}
                >
                  Take Photo
                </button>
                {!image && (
                  <input 
                    className="p-2" 
                    type="file" 
                    accept="image/*" 
                    onChange={handleFileUpload}
                  />
                )}
              </div>
            )}
            {image && !isCameraActive && (
              <div className="flex-col items-center justify-center">
                <Image 
                  src={image}
                  alt="Receipt image"
                  width={640}
                  height={480}
                  className="w-full h-auto rounded-lg"
                />
                <div className="flex justify-between">
                  <button 
                    className="bg-blue-600 p-2 rounded-md px-4"
                    onClick={handleAnalyzeClick}
                  >
                    Analyze Receipt
                  </button>
                  <button 
                    className="bg-red-600 p-2 rounded-md px-4"
                    onClick={() => {
                      setImage('');
                      setIsUploadedImage(false);
                      setAnalysisError(null); // Clear error message
                    }}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
          <div className="flex justify-between items-center w-full mb-4">
            <input
              type="text"
              className="text-black p-2 border rounded w-1/4"
              placeholder="Search expenses..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            <select
              className="text-black p-2 border rounded w-1/4"
              value={selectedTaxYear}
              onChange={(e) => setSelectedTaxYear(e.target.value)}
            >
              <option value="">All Tax Years</option>
              {getUniqueTaxYears().map(year => (
                <option key={year} value={year.toString()}>{year} Tax Year</option>
              ))}
            </select>
            <div className="text-white text-xl">
              Total: ${calculateTotalForSelectedYear(new Date(selectedTaxYear).getFullYear())}
            </div>
            <button
              onClick={exportToExcel}
              className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-lg flex items-center"
            >
              <ArrowDownTrayIcon className="h-5 w-5 mr-2" />
              Export Excel
            </button>
          </div>
          <div className="overflow-x-auto w-full">
            <table className="w-full text-left">
              <thead>
                <tr className="text-white">
                  <th className="p-2">Date</th>
                  <th className="p-2">Merchant</th>
                  <th className="p-2 w-1/4">Item Name</th>
                  <th className="p-2">Price</th>
                  <th className="p-2">Tax</th>
                  <th className="p-2">Total Price</th>
                  <th className="p-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredExpenses.map((expense) => (
                  <tr key={expense.id} className="bg-slate-950 text-white">
                    <td className="p-2">
                      {editingExpense?.id === expense.id ? (
                        <input
                          type="date"
                          value={editingExpense?.date || ''}
                          onChange={(e) => handleEditChange('date', e.target.value)}
                          className="bg-slate-800 text-white p-1 rounded"
                        />
                      ) : (
                        formatDate(new Date(expense.date))
                      )}
                    </td>
                    <td className="p-2">
                      {editingExpense?.id === expense.id ? (
                        <input
                          type="text"
                          value={editingExpense?.merchant || ''}
                          onChange={(e) => handleEditChange('merchant', e.target.value)}
                          className="bg-slate-800 text-white p-1 rounded"
                        />
                      ) : (
                        expense.merchant
                      )}
                    </td>
                    <td className="p-2 w-1/4">
                      {editingExpense?.id === expense.id ? (
                        <input
                          type="text"
                          value={editingExpense?.itemName || ''}
                          onChange={(e) => handleEditChange('itemName', e.target.value)}
                          className="bg-slate-800 text-white p-1 rounded w-full"
                        />
                      ) : (
                        expense.itemName
                      )}
                    </td>
                    <td className="p-2">
                      {editingExpense?.id === expense.id ? (
                        <input
                          type="number"
                          value={editingExpense?.price || 0}
                          onChange={(e) => handleEditChange('price', parseFloat(e.target.value))}
                          className="bg-slate-800 text-white p-1 rounded w-full"
                        />
                      ) : (
                        expense.price
                      )}
                    </td>
                    <td className="p-2">
                      {editingExpense?.id === expense.id ? (
                        <input
                          type="number"
                          value={editingExpense?.tax || 0}
                          onChange={(e) => handleEditChange('tax', Number(parseFloat(e.target.value).toFixed(2)))}
                          className="bg-slate-800 text-white p-1 rounded"
                          step="0.01"
                        />
                      ) : (
                        expense.tax.toFixed(2)
                      )}
                    </td>
                    <td className="p-2">
                      {editingExpense?.id === expense.id ? (
                        <input
                          type="number"
                          value={editingExpense?.totalPrice || 0}
                          onChange={(e) => handleEditChange('totalPrice', Number(parseFloat(e.target.value).toFixed(2)))}
                          className="bg-slate-800 text-white p-1 rounded"
                          step="0.01"
                        />
                      ) : (
                        expense.totalPrice.toFixed(2)
                      )}
                    </td>
                    <td className="p-2">
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => toggleEdit(expense)}
                          className={`${
                            editingExpense?.id === expense.id
                              ? 'bg-green-500 hover:bg-green-600'
                              : 'bg-blue-500 hover:bg-blue-600'
                          } text-white px-3 py-1 rounded-lg flex items-center`}
                        >
                          {editingExpense?.id === expense.id ? 'Save' : 'Edit'}
                        </button>
                        <button
                          onClick={() => deleteExpense(expense.id!)}
                          className="bg-red-500 hover:bg-red-600 text-white p-1 rounded-lg flex items-center"
                        >
                          <TrashIcon className="h-5 w-5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {analysisError && (
            <div className="text-red-500 mt-2">{analysisError}</div>
          )}
        </div>
      </div>
    </main>
  ) : null;
}
