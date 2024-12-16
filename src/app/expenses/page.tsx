'use client'
import { useState, useEffect, useCallback, useMemo } from 'react';
import { collection, addDoc, query, onSnapshot, deleteDoc, doc, updateDoc, where, Firestore } from 'firebase/firestore';
import { db } from '../firebase';
import { PlusIcon, TrashIcon, ArrowDownTrayIcon, ArrowUpTrayIcon } from "@heroicons/react/16/solid";
import { useAuth } from "../authcontext";
import { useRouter } from "next/navigation";
import { CameraComp } from "../CameraComp";
import { run } from "../../server/services/genai/app";
import * as XLSX from 'xlsx';
import Image from 'next/image';
import { 
  Chart as ChartJS, 
  ArcElement, 
  Tooltip, 
  Legend,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Filler
} from 'chart.js';
import { Pie, Line } from 'react-chartjs-2';

ChartJS.register(
  ArcElement,
  Tooltip,
  Legend,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Filler
);

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
  expensed: boolean;
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

const ITEMS_PER_PAGE = 15; // You can adjust this number

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
    hsaEligible: false,
    expensed: false
  });
  const [image, setImage] = useState('');
  const [displayImage, setDisplayImage] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [selectedTaxYear, setSelectedTaxYear] = useState<string>('');
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [isUploadedImage, setIsUploadedImage] = useState(false);
  const [isClient, setIsClient] = useState(false);
  const [editingDate, setEditingDate] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);

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
      router.push('/');
      return;
    }

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
        hsaEligible: false,
        expensed: false
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
    if (!imageData || !db || !user) {
      console.log('Missing required data:', { 
        hasImageData: !!imageData, 
        hasDB: !!db, 
        hasUser: !!user 
      });
      return;
    }

    setAnalysisError(null);
    setIsAnalyzing(true);
    try {
      console.log('Getting user token...');
      const idToken = await user.getIdToken();
      console.log('Sending request to backend...');
      const response = await fetch('http://localhost:5001/api/receipts/analyze', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`
        },
        body: JSON.stringify({ imageData })
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        console.error('Backend error:', errorData);
        throw new Error(errorData.error || 'Failed to analyze receipt');
      }

      console.log('Got response from backend, parsing...');
      const { text } = await response.json();
      
      let parsedResult;
      try {
        // First attempt: direct parse
        parsedResult = JSON.parse(text);
      } catch (parseError) {
        console.error("Error parsing JSON:", parseError);
        try {
          // Second attempt: clean the string more aggressively
          const cleanedJsonString = text
            .replace(/\n\s*/g, '')        // Remove newlines and spaces
            .replace(/,\s*]/g, ']')       // Remove trailing commas in arrays
            .replace(/,\s*}/g, '}')       // Remove trailing commas in objects
            .replace(/\\n/g, '')          // Remove escaped newlines
            .replace(/\s+/g, ' ')         // Replace multiple spaces with single space
            .trim();
          
          parsedResult = JSON.parse(cleanedJsonString);
        } catch (secondParseError) {
          console.error("Error parsing cleaned JSON:", secondParseError, "\nText was:", text);
          setAnalysisError("Unable to parse the receipt data. Please try again.");
          return;
        }
      }
      
      if (!parsedResult || typeof parsedResult !== 'object') {
        setAnalysisError("Invalid receipt data format. Please try again.");
        return;
      }

      if (!parsedResult.items || !Array.isArray(parsedResult.items)) {
        setAnalysisError("No items found in the receipt data. Please try again.");
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
          hsaEligible: false,
          expensed: false
        });
        setImage('');
      } else {
        setAnalysisError("No HSA-eligible items found in the receipt.");
      }
      
    } catch (error) {
      console.error("Error analyzing image:", error);
      setAnalysisError("An error occurred while analyzing the image. Please try again.");
    } finally {
      setIsAnalyzing(false);
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
      const updatedExpense = { ...editingExpense, [field]: value };
      
      // Update total price when tax or price changes
      if (field === 'tax' || field === 'price') {
        const price = field === 'price' ? Number(value) : editingExpense.price;
        const tax = field === 'tax' ? Number(value) : editingExpense.tax;
        updatedExpense.totalPrice = Number((price + tax).toFixed(2));
      }
      
      setEditingExpense(updatedExpense);
    }
  };

  // Add this new function to get unique tax years from expenses
  const getUniqueTaxYears = () => {
    const years = expenses.map(expense => new Date(expense.date).getFullYear());
    return Array.from(new Set(years)).sort((a, b) => b - a); // Sort in descending order
  };

  // Update the filteredExpenses calculation
  const filteredExpenses = useMemo(() => {
    return expenses.filter(expense => {
      const expenseYear = new Date(expense.date).getFullYear().toString();
      const matchesSearch = 
        expense.merchant.toLowerCase().includes(searchQuery.toLowerCase()) ||
        expense.date.includes(searchQuery) ||
        expense.itemName.toLowerCase().includes(searchQuery.toLowerCase());
      
      return (selectedTaxYear === '' || expenseYear === selectedTaxYear) && matchesSearch;
    });
  }, [expenses, selectedTaxYear, searchQuery]);

  // Calculate pagination
  const totalPages = Math.ceil(filteredExpenses.length / ITEMS_PER_PAGE);
  const paginatedExpenses = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredExpenses.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [filteredExpenses, currentPage]);

  // Add pagination controls component
  const PaginationControls = () => (
    <div className="flex justify-center items-center gap-2 my-4">
      <button
        onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
        disabled={currentPage === 1}
        className="relative group disabled:opacity-50"
      >
        <div className="absolute -inset-0.5 bg-gradient-to-r from-pink-500 to-violet-500 rounded-lg blur opacity-50 group-hover:opacity-75 transition-all"></div>
        <div className="relative bg-[#0B1120] text-white px-3 py-1 rounded-lg">
          Previous
        </div>
      </button>
      
      <span className="text-slate-300">
        Page {currentPage} of {totalPages}
      </span>
      
      <button
        onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
        disabled={currentPage === totalPages}
        className="relative group disabled:opacity-50"
      >
        <div className="absolute -inset-0.5 bg-gradient-to-r from-pink-500 to-violet-500 rounded-lg blur opacity-50 group-hover:opacity-75 transition-all"></div>
        <div className="relative bg-[#0B1120] text-white px-3 py-1 rounded-lg">
          Next
        </div>
      </button>
    </div>
  );

  const calculateTotals = useCallback((year: number) => {
    const relevantExpenses = filteredExpenses.filter(expense => {
      if (year) {
        return new Date(expense.date).getFullYear() === year;
      }
      return true;
    });

    const total = relevantExpenses.reduce((sum, expense) => sum + expense.totalPrice, 0);
    const expensedTotal = relevantExpenses.reduce((sum, expense) => 
      sum + (expense.expensed ? expense.totalPrice : 0), 0);
    const nonExpensedTotal = total - expensedTotal;

    return {
      total: total.toFixed(2),
      nonExpensedTotal: nonExpensedTotal.toFixed(2)
    };
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

    const total = calculateTotals(parseInt(selectedTaxYear) || new Date().getFullYear()).total;
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
  }, [filteredExpenses, selectedTaxYear, calculateTotals, formatDate]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        try {
          const result = reader.result;
          if (typeof result === 'string') {
            setImage(result);
            setIsUploadedImage(true);
            setAnalysisError(null);
          }
        } catch (error) {
          setAnalysisError("Error processing image. Please try again.");
        }
      };
      reader.onerror = () => {
        setAnalysisError("Error reading file. Please try again.");
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

  const handleKeyDown = (e: React.KeyboardEvent, expense: Expense) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      toggleEdit(expense);
    }
  };

  // Add this function to calculate yearly totals
  const calculateYearlyTotals = useCallback(() => {
    const yearlyTotals = expenses.reduce((acc, expense) => {
      const year = new Date(expense.date).getFullYear();
      acc[year] = (acc[year] || 0) + expense.totalPrice;
      return acc;
    }, {} as Record<number, number>);

    // Sort years in descending order
    const sortedYears = Object.keys(yearlyTotals).sort((a, b) => Number(b) - Number(a));
    
    return {
      labels: sortedYears.map(year => `${year} Tax Year`),
      data: sortedYears.map(year => yearlyTotals[Number(year)]),
    };
  }, [expenses]);

  // Add pie chart data
  const pieChartData = useMemo(() => {
    const { labels, data } = calculateYearlyTotals();
    return {
      labels,
      datasets: [
        {
          data,
          backgroundColor: [
            'rgba(236, 72, 153, 0.8)',    // pink-500 (vibrant pink)
            'rgba(139, 92, 246, 0.8)',    // violet-500 (medium purple)
            'rgba(34, 211, 238, 0.8)',    // cyan-400 (bright cyan)
            'rgba(16, 185, 129, 0.8)',    // emerald-500 (emerald)
            'rgba(99, 102, 241, 0.8)',    // indigo-500 (indigo)
          ],
          borderColor: [
            'rgba(236, 72, 153, 1)',      // pink-500
            'rgba(139, 92, 246, 1)',      // violet-500
            'rgba(34, 211, 238, 1)',      // cyan-400
            'rgba(16, 185, 129, 1)',      // emerald-500
            'rgba(99, 102, 241, 1)',      // indigo-500
          ],
          borderWidth: 1,
        },
      ],
    };
  }, [calculateYearlyTotals]);

  const chartOptions = {
    plugins: {
      legend: {
        position: 'right' as const,
        labels: {
          color: 'rgba(226, 232, 240, 1)',
          font: {
            size: 14,
            weight: 'bold' as const
          },
          padding: 20,
          usePointStyle: true,
          pointStyle: 'circle'
        }
      },
      tooltip: {
        callbacks: {
          label: (context: any) => {
            const value = context.raw;
            const total = context.dataset.data.reduce((a: number, b: number) => a + b, 0);
            const percentage = ((value / total) * 100).toFixed(1);
            return `$${value.toFixed(2)} (${percentage}%)`;
          }
        },
        titleFont: {
          size: 14,
          weight: 'bold' as const
        },
        bodyFont: {
          size: 13
        },
        backgroundColor: 'rgba(15, 23, 42, 0.9)',
        titleColor: 'rgba(226, 232, 240, 1)',
        bodyColor: 'rgba(226, 232, 240, 1)',
        borderColor: 'rgba(71, 85, 105, 0.5)',
        borderWidth: 1,
        padding: 12,
        displayColors: true,
        boxPadding: 3
      }
    },
    maintainAspectRatio: false
  };

  // Add this function to handle price and tax changes
  const handleExpenseChange = (field: keyof Expense, value: string | number) => {
    const updatedExpense = { ...newExpense, [field]: value };
    
    // Auto-calculate total price if price or tax changes
    if (field === 'price' || field === 'tax') {
      const price = field === 'price' ? Number(value) : newExpense.price;
      const tax = field === 'tax' ? Number(value) : newExpense.tax;
      updatedExpense.totalPrice = Number((price + tax).toFixed(2));
    }
    
    setNewExpense(updatedExpense);
  };

  const handleExpensedChange = async (expense: Expense) => {
    if (!db || !expense.id) return;
    
    try {
      await updateDoc(doc(db as Firestore, 'expenses', expense.id), {
        expensed: !expense.expensed
      });
    } catch (error) {
      console.error("Error updating expensed status:", error);
    }
  };

  // Add new function to calculate growth projection
  const calculateGrowthProjection = useCallback(() => {
    const annualReturn = 0.0982; // 9.82%
    const projectionYears = 35;
    const yearStep = 5;
    const projectionData: { year: number; amount: number }[] = [];
    
    // Get non-expensed amounts by year
    const nonExpensedByYear = expenses.reduce((acc, expense) => {
      const year = new Date(expense.date).getFullYear();
      if (!expense.expensed) {
        acc[year] = (acc[year] || 0) + expense.totalPrice;
      }
      return acc;
    }, {} as Record<number, number>);

    // Calculate total non-expensed amount
    const totalNonExpensed = Object.values(nonExpensedByYear).reduce((sum, amount) => sum + amount, 0);
    
    // Start with year 0 showing 0 (since we haven't realized any gains yet)
    projectionData.push({ year: 0, amount: 0 });
    
    // Calculate growth for each 5-year interval
    for (let year = yearStep; year <= projectionYears; year += yearStep) {
      // Calculate the growth amount (future value minus initial investment)
      const futureValue = totalNonExpensed * Math.pow(1 + annualReturn, year);
      const growthAmount = futureValue - totalNonExpensed;
      
      // Only show the growth amount (profit after subtracting initial investment)
      projectionData.push({ year, amount: growthAmount });
    }

    return projectionData;
  }, [expenses]);

  // Add growth chart data
  const growthChartData = useMemo(() => {
    const projectionData = calculateGrowthProjection();
    
    return {
      labels: projectionData.map(d => `Year ${d.year}`),
      datasets: [
        {
          label: 'Projected HSA Growth (After Subtracting Initial Investment)',
          data: projectionData.map(d => d.amount),
          borderColor: 'rgba(236, 72, 153, 1)',      // pink-500
          backgroundColor: 'rgba(236, 72, 153, 0.1)', // pink-500 with low opacity
          borderWidth: 2,
          fill: true,
          tension: 0.4,
        }
      ]
    };
  }, [calculateGrowthProjection]);

  // Add growth chart options
  const growthChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false
      },
      tooltip: {
        callbacks: {
          label: (context: any) => {
            return `$${context.raw.toLocaleString(undefined, {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2
            })}`;
          }
        },
        titleFont: {
          size: 16,
          weight: 'bold' as const
        },
        bodyFont: {
          size: 15
        },
        backgroundColor: 'rgba(15, 23, 42, 0.95)',
        titleColor: 'rgba(226, 232, 240, 1)',
        bodyColor: 'rgba(226, 232, 240, 1)',
        borderColor: 'rgba(71, 85, 105, 0.5)',
        borderWidth: 1,
        padding: 16,
        displayColors: false,
        cornerRadius: 8
      }
    },
    scales: {
      x: {
        grid: {
          color: 'rgba(148, 163, 184, 0.1)',
          drawBorder: false
        },
        ticks: {
          color: 'rgba(226, 232, 240, 1)',
          font: {
            size: 13
          }
        }
      },
      y: {
        grid: {
          color: 'rgba(148, 163, 184, 0.1)',
          drawBorder: false
        },
        ticks: {
          color: 'rgba(226, 232, 240, 1)',
          font: {
            size: 13
          },
          callback: (value: number) => {
            return `$${value.toLocaleString(undefined, {
              minimumFractionDigits: 0,
              maximumFractionDigits: 0
            })}`;
          }
        }
      }
    },
    elements: {
      point: {
        radius: 4, // Default point size
        hoverRadius: 8, // Bigger point size on hover
        backgroundColor: 'rgba(236, 72, 153, 1)', // pink-500
        borderColor: 'rgba(236, 72, 153, 1)',
        borderWidth: 2,
        hoverBorderWidth: 3,
        hoverBorderColor: 'rgba(236, 72, 153, 1)',
        hoverBackgroundColor: 'white',
      },
      line: {
        tension: 0.4,
        borderWidth: 3,
      }
    },
    interaction: {
      intersect: false,
      mode: 'index' as const,
    }
  };

  return isClient ? (
    <main className="min-h-screen bg-[#0B1120] flex flex-col items-center justify-between p-4">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(93,52,211,0.1),transparent_50%),radial-gradient(ellipse_at_bottom,rgba(236,72,153,0.1),transparent_50%)]"></div>
      
      <div className="z-10 w-full max-w-[1400px] items-center justify-between font-mono">
        <div className="flex justify-between items-center mb-4">
          <h1 className="text-[2.5rem] font-extrabold">
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-pink-500 via-purple-500 to-violet-500">
              HSA Expense Tracker
            </span>
          </h1>
          <button
            onClick={handleLogout}
            className="relative group min-w-[120px]"
          >
            <div className="absolute -inset-0.5 bg-gradient-to-r from-pink-500 to-violet-500 rounded-lg blur opacity-50 group-hover:opacity-75 transition-all"></div>
            <div className="relative bg-[#0B1120] text-white px-4 py-2 rounded-lg font-semibold flex items-center justify-center gap-2">
              Logout
            </div>
          </button>
        </div>

        <div className="bg-slate-800/50 backdrop-blur-sm p-8 rounded-lg border border-slate-700">
          <form onSubmit={addExpense} className="grid grid-cols-7 gap-4 items-center mb-6">
            <div className="col-span-1 text-slate-300 text-center font-semibold">Date</div>
            <div className="col-span-1 text-slate-300 text-center font-semibold">Merchant</div>
            <div className="col-span-2 text-slate-300 text-center font-semibold">Item Name</div>
            <div className="col-span-1 text-slate-300 text-center font-semibold">Price</div>
            <div className="col-span-1 text-slate-300 text-center font-semibold">Tax</div>
            <div className="col-span-1 text-slate-300 text-center font-semibold">Total Price</div>
            
            <input
              value={newExpense.date}
              onChange={(e) => setNewExpense({ ...newExpense, date: e.target.value })}
              className="col-span-1 p-2 bg-slate-900/50 border border-slate-700 rounded-lg text-white" 
              type="date" 
              required
            />
            <input
              value={newExpense.merchant}
              onChange={(e) => setNewExpense({ ...newExpense, merchant: e.target.value })}
              className="col-span-1 p-2 bg-slate-900/50 border border-slate-700 rounded-lg text-white" 
              type="text" 
              placeholder="Merchant" 
              required
            />
            <input
              value={newExpense.itemName}
              onChange={(e) => setNewExpense({ ...newExpense, itemName: e.target.value })}
              className="col-span-2 p-2 bg-slate-900/50 border border-slate-700 rounded-lg text-white" 
              type="text" 
              placeholder="Item Name" 
              required
            />
            <input
              value={newExpense.price}
              onChange={(e) => handleExpenseChange('price', parseFloat(e.target.value) || 0)}
              className="col-span-1 p-2 bg-slate-900/50 border border-slate-700 rounded-lg text-white"
              type="number"
              step="0.01"
              placeholder="Price"
              required
            />
            <input
              value={newExpense.tax}
              onChange={(e) => handleExpenseChange('tax', parseFloat(e.target.value) || 0)}
              className="col-span-1 p-2 bg-slate-900/50 border border-slate-700 rounded-lg text-white"
              type="number"
              step="0.01"
              placeholder="Tax"
              required
            />
            <input
              value={newExpense.totalPrice}
              onChange={(e) => handleExpenseChange('totalPrice', parseFloat(e.target.value) || 0)}
              className="col-span-1 p-2 bg-slate-900/50 border border-slate-700 rounded-lg text-white"
              type="number"
              step="0.01"
              placeholder="Total Price"
              required
            />
            <div className="col-span-7 mt-2">
              <button className="w-full relative group" type="submit">
                <div className="absolute -inset-0.5 bg-gradient-to-r from-pink-500 to-violet-500 rounded-lg blur opacity-50 group-hover:opacity-75 transition-all"></div>
                <div className="relative bg-[#0B1120] text-white px-4 py-2 rounded-lg font-semibold flex items-center justify-center gap-2">
                  <PlusIcon className="h-6 w-6" />
                  Add Expense
                </div>
              </button>
            </div>
          </form>

          <div className="flex-col items-center justify-between w-full mb-6">
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
              <div className="flex flex-col items-center gap-4">
                <div className="flex justify-center space-x-4 mb-4">
                  <button 
                    className="relative group"
                    onClick={() => {
                      setIsCameraActive(true);
                      setAnalysisError(null);
                    }}
                  >
                    <div className="absolute -inset-0.5 bg-gradient-to-r from-pink-500 to-violet-500 rounded-lg blur opacity-50 group-hover:opacity-75 transition-all"></div>
                    <div className="relative bg-[#0B1120] text-white px-4 py-2 rounded-lg font-semibold">
                      Take Photo
                    </div>
                  </button>
                  {!image && (
                    <div className="relative group inline-block">
                      <div className="absolute -inset-0.5 bg-gradient-to-r from-pink-500 to-violet-500 rounded-lg blur opacity-50 group-hover:opacity-75 transition-all"></div>
                      <label className="relative bg-[#0B1120] text-white px-4 py-2 rounded-lg font-semibold cursor-pointer flex items-center">
                        Choose File
                        <input 
                          type="file" 
                          accept="image/*" 
                          onChange={handleFileUpload}
                          className="hidden"
                        />
                      </label>
                    </div>
                  )}
                </div>

                {image && (
                  <div className="flex flex-col items-center gap-4 w-full max-w-2xl">
                    {isUploadedImage ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img 
                        src={image}
                        alt="Receipt image"
                        className="w-full h-auto rounded-lg"
                      />
                    ) : (
                      <Image 
                        src={image}
                        alt="Receipt image"
                        width={640}
                        height={480}
                        className="w-full h-auto rounded-lg"
                        unoptimized
                      />
                    )}
                    <div className="flex justify-center gap-4 mt-4">
                      <button 
                        className="relative group"
                        onClick={handleAnalyzeClick}
                      >
                        <div className="absolute -inset-0.5 bg-gradient-to-r from-pink-500 to-violet-500 rounded-lg blur opacity-50 group-hover:opacity-75 transition-all"></div>
                        <div className="relative bg-[#0B1120] text-white px-4 py-2 rounded-lg font-semibold">
                          Analyze Receipt
                        </div>
                      </button>
                      <button 
                        className="relative group"
                        onClick={() => {
                          setImage('');
                          setIsUploadedImage(false);
                          setAnalysisError(null);
                        }}
                      >
                        <div className="absolute -inset-0.5 bg-gradient-to-r from-pink-500 to-violet-500 rounded-lg blur opacity-50 group-hover:opacity-75 transition-all"></div>
                        <div className="relative bg-[#0B1120] text-white px-4 py-2 rounded-lg font-semibold">
                          Cancel
                        </div>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="flex justify-between items-center w-full mb-6 gap-4">
              <input
                type="text"
                className="bg-slate-900/50 text-white p-2 border border-slate-700 rounded-lg w-64"
                placeholder="Search expenses..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              <select
                className="bg-slate-900/50 text-white p-2 border border-slate-700 rounded-lg w-64"
                value={selectedTaxYear}
                onChange={(e) => setSelectedTaxYear(e.target.value)}
              >
                <option value="">All Tax Years</option>
                {getUniqueTaxYears().map(year => (
                  <option key={year} value={year.toString()}>{year} Tax Year</option>
                ))}
              </select>
              <div className="text-slate-300 text-xl font-semibold whitespace-nowrap">
                Total: ${calculateTotals(parseInt(selectedTaxYear) || 0).total}
              </div>
              <button
                onClick={exportToExcel}
                className="relative group whitespace-nowrap"
              >
                <div className="absolute -inset-0.5 bg-gradient-to-r from-pink-500 to-violet-500 rounded-lg blur opacity-50 group-hover:opacity-75 transition-all"></div>
                <div className="relative bg-[#0B1120] text-white px-4 py-2 rounded-lg font-semibold flex items-center gap-2">
                  <ArrowDownTrayIcon className="h-5 w-5" />
                  Export Excel
                </div>
              </button>
            </div>

            <div className="overflow-x-auto w-full mb-8">
              <table className="w-full text-left">
                <thead>
                  <tr>
                    <th className="p-3 w-[15%] text-slate-300 font-semibold">Date</th>
                    <th className="p-3 w-[15%] text-slate-300 font-semibold">Merchant</th>
                    <th className="p-3 w-[30%] text-slate-300 font-semibold">Item Name</th>
                    <th className="p-3 w-[10%] text-slate-300 font-semibold">Price</th>
                    <th className="p-3 w-[10%] text-slate-300 font-semibold">Tax</th>
                    <th className="p-3 w-[10%] text-slate-300 font-semibold">Total Price</th>
                    <th className="p-3 w-[8%] text-slate-300 font-semibold text-center">Expensed</th>
                    <th className="p-3 w-[12%] text-slate-300 font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedExpenses.map((expense) => (
                    <tr key={expense.id} className="border-t border-slate-700/50">
                      <td className="p-2">
                        {editingExpense?.id === expense.id ? (
                          editingDate === expense.id ? (
                            <input
                              type="date"
                              value={editingExpense?.date || ''}
                              onChange={(e) => handleEditChange('date', e.target.value)}
                              onKeyDown={(e) => handleKeyDown(e, expense)}
                              onBlur={() => setEditingDate(null)}
                              className="bg-slate-800 text-white p-1 rounded w-full"
                              autoFocus
                            />
                          ) : (
                            <div
                              onClick={() => setEditingDate(expense.id ?? null)}
                              className="cursor-pointer hover:bg-slate-700 p-1 rounded w-full"
                            >
                              {formatDate(new Date(expense.date))}
                            </div>
                          )
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
                            onKeyDown={(e) => handleKeyDown(e, expense)}
                            className="bg-slate-800 text-white p-1 rounded w-full"
                          />
                        ) : (
                          expense.merchant
                        )}
                      </td>
                      <td className="p-2">
                        {editingExpense?.id === expense.id ? (
                          <input
                            type="text"
                            value={editingExpense?.itemName || ''}
                            onChange={(e) => handleEditChange('itemName', e.target.value)}
                            onKeyDown={(e) => handleKeyDown(e, expense)}
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
                            value={editingExpense?.price || ''}
                            onChange={(e) => handleEditChange('price', parseFloat(e.target.value))}
                            onKeyDown={(e) => handleKeyDown(e, expense)}
                            className="bg-slate-800 text-white p-1 rounded w-full"
                            min="0"
                            step="0.01"
                          />
                        ) : (
                          expense.price.toFixed(2)
                        )}
                      </td>
                      <td className="p-2">
                        {editingExpense?.id === expense.id ? (
                          <input
                            type="number"
                            value={editingExpense?.tax || ''}
                            onChange={(e) => handleEditChange('tax', Number(parseFloat(e.target.value).toFixed(2)))}
                            onKeyDown={(e) => handleKeyDown(e, expense)}
                            className="bg-slate-800 text-white p-1 rounded w-[80px]"
                            step="0.01"
                            min="0"
                          />
                        ) : (
                          expense.tax.toFixed(2)
                        )}
                      </td>
                      <td className="p-2">
                        {editingExpense?.id === expense.id ? (
                          <input
                            type="number"
                            value={editingExpense?.totalPrice || ''}
                            onChange={(e) => handleEditChange('totalPrice', Number(parseFloat(e.target.value).toFixed(2)))}
                            onKeyDown={(e) => handleKeyDown(e, expense)}
                            className="bg-slate-800 text-white p-1 rounded w-[80px]"
                            step="0.01"
                            min="0"
                          />
                        ) : (
                          expense.totalPrice.toFixed(2)
                        )}
                      </td>
                      <td className="p-2 text-center">
                        <div className="relative inline-block">
                          <input
                            type="checkbox"
                            checked={expense.expensed}
                            onChange={() => handleExpensedChange(expense)}
                            className="peer appearance-none w-5 h-5 rounded border-2 border-slate-500 bg-slate-800/50 
                                      checked:border-0 checked:bg-gradient-to-r checked:from-pink-500 checked:to-violet-500 
                                      focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-800 focus:ring-pink-500 
                                      transition-all duration-200 cursor-pointer"
                          />
                          <svg
                            className="absolute w-4 h-4 top-0.5 left-0.5 pointer-events-none opacity-0 peer-checked:opacity-100 text-white transition-opacity"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2.5}
                              d="M5 13l4 4L19 7"
                            />
                          </svg>
                        </div>
                      </td>
                      <td className="p-2">
                        <div className="flex items-center space-x-2">
                          <button
                            onClick={() => toggleEdit(expense)}
                            className="relative group"
                          >
                            <div className="absolute -inset-0.5 bg-gradient-to-r from-pink-500 to-violet-500 rounded-lg blur opacity-50 group-hover:opacity-75 transition-all"></div>
                            <div className="relative bg-[#0B1120] text-white px-3 py-1 rounded-lg flex items-center">
                              {editingExpense?.id === expense.id ? 'Save' : 'Edit'}
                            </div>
                          </button>
                          
                          <button
                            onClick={() => {}} // Empty handler for now - future feature
                            className="relative group"
                            title="Upload Receipt (Coming Soon)"
                          >
                            <div className="absolute -inset-0.5 bg-gradient-to-r from-pink-500 to-violet-500 rounded-lg blur opacity-50 group-hover:opacity-75 transition-all"></div>
                            <div className="relative bg-[#0B1120] text-white p-1 rounded-lg flex items-center">
                              <ArrowUpTrayIcon className="h-5 w-5" />
                            </div>
                          </button>

                          <button
                            onClick={() => deleteExpense(expense.id!)}
                            className="relative group"
                          >
                            <div className="absolute -inset-0.5 bg-gradient-to-r from-pink-500 to-violet-500 rounded-lg blur opacity-50 group-hover:opacity-75 transition-all"></div>
                            <div className="relative bg-[#0B1120] text-white p-1 rounded-lg flex items-center">
                              <TrashIcon className="h-5 w-5" />
                            </div>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              
              {/* Add pagination controls */}
              <PaginationControls />
            </div>

            {isAnalyzing && (
              <div className="relative group inline-block mt-4">
                <div className="absolute -inset-0.5 bg-gradient-to-r from-pink-500 to-violet-500 rounded-lg blur opacity-50 group-hover:opacity-75 transition-all"></div>
                <div className="relative bg-[#0B1120] text-white px-4 py-2 rounded-lg font-semibold flex items-center gap-2">
                  <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Analyzing Receipt...
                </div>
              </div>
            )}

            {analysisError && (
              <div className="relative group inline-block mt-4">
                <div className="absolute -inset-0.5 bg-gradient-to-r from-red-500 to-pink-500 rounded-lg blur opacity-50 group-hover:opacity-75 transition-all"></div>
                <div className="relative bg-[#0B1120] text-white px-4 py-2 rounded-lg font-semibold flex items-center gap-2">
                  <svg className="h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  {analysisError}
                </div>
              </div>
            )}
            
            <div className="mt-12 w-full">
              <h2 className="text-2xl mb-6 font-extrabold">
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-pink-500 via-purple-500 to-violet-500">
                  Yearly Expense Distribution
                </span>
              </h2>
              <div className="bg-slate-800/50 backdrop-blur-sm p-8 rounded-lg border border-slate-700" style={{ height: '400px' }}>
                {pieChartData.labels.length > 0 ? (
                  <Pie data={pieChartData} options={chartOptions} />
                ) : (
                  <div className="text-slate-300 text-center h-full flex items-center justify-center">
                    No expense data available
                  </div>
                )}
              </div>
            </div>

            <div className="mt-12 w-full">
              <h2 className="text-2xl mb-6 font-extrabold">
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-pink-500 via-purple-500 to-violet-500">
                  Projected HSA Investment Growth (Net of Initial Investment)
                </span>
              </h2>
              <div className="bg-slate-800/50 backdrop-blur-sm p-8 rounded-lg border border-slate-700" style={{ height: '400px' }}>
                {growthChartData.labels.length > 0 ? (
                  <Line data={growthChartData} options={growthChartOptions} />
                ) : (
                  <div className="text-slate-300 text-center h-full flex items-center justify-center">
                    No projection data available
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  ) : null;
}
