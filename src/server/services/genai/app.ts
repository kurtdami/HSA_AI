import { GoogleGenerativeAI } from "@google/generative-ai";
// import fs from 'fs';
import mime from 'mime';
import * as dotenv from "dotenv";
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Load environment variables
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '../../../.env') });


async function run(imagePath) {
    if (!process.env.GEMINI_API_KEY) {
      throw new Error('Gemini API key not configured');
    }
    
   
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({
        model: "gemini-2.0-flash-exp"
    });

    const prompt = `Analyze this receipt image and identify Health Spending Account (HSA)-eligible items. HSA-eligible items are generally those used for medical care, to alleviate or treat a specific medical condition, or for preventive care.
Key Classification Rules:

Primary Purpose Test:

Evaluate the item's primary marketed purpose
If the item is primarily for treating, alleviating, or preventing a medical condition, it's eligible
If the item has therapeutic active ingredients, it's eligible
Items marketed as medicines or treatments are eligible


Product Category Recognition:

Check if the item falls under any of the qualified medical categories listed below
Consider both generic and branded versions of medical items as eligible
Items that treat symptoms (pain, cough, cold, etc.) are eligible
Items that provide therapeutic benefits for medical conditions are eligible
Consider product names as potential indicators of their medical category alignment

Medical vs. General Use:

When an item can be used for both medical and non-medical purposes:

If marketed/sold as a medical treatment → eligible
If containing active medical ingredients → eligible
If primarily for symptom relief → eligible
If marketed for general comfort/convenience → not eligible
If for general hygiene/grooming or daily use items even if they have health benefits → not eligible


Return a JSON response with the following structure:
{
"date": "YYYY-MM-DD",
"merchant": "Store Name",
"taxRate": "look for %"
"items": [
{
"name": "Item Name",
"price": 0.00,
"HealthSpendingAccountEligible": true/false,
"eligibilityReason": "Brief explanation based on above rules",
"priceAnalysis": "Explanation of how the price was determined from the image"
}
]
}

Additional rules:
Qualified Medical and Over-the-Counter Items might include 
"
 Abdominal/Back Supports
 Abortion (legal)
 Acid Controllers
 Acne Medications
 Acupuncture
 Allergy & Sinus Medications
 Alcoholism (inpatient treatment)
 Ambulance Services
 Analgesics
 Anesthesiology
 Antacids
 Anti-Diarrheal Medications
 Anti-Gas Products
 Anti-Itch and Insect Bite Creams
 Antihistamines
 Antibiotic Ointments
 Artificial Limbs
 Aspirin
 Automated External Defibrillator
 Breathing Aids
 Baby Rash Ointments & Creams
 Birth Control and Contraceptive
Pills and Implants
 Blood Pressure Monitors
 Blood Sugar Test Kits/Supplies
 Blood Tests
 Body Scan
 Braille Books and Magazines
 Breast Pumps and Lactation
supplies
 Breast Reconstruction Surgery
 Cancer Screening
 Cardiograph
 Childbirth Classes (Lamaze)
 Clinical Trials
 Cough Drops
 Cold, Cough & Flu Medications
 Cold Sore Remedies
 Compression Hose/Stockings
 Contact Lens Supplies
 Cold/hot packs for injuries
 Colonoscopy
 Condoms
 Counseling
 CPAP Devices
 Crutches
 CT Scan
 Decongestants
 Denture Adhesives
 Diabetic Supplies
 Diagnostic Testing
 Dialysis
 Drug Addiction Treatment
 Durable Medical Equipment
 Ear Wax Removal Treatments
 Echocardiogram and EKG
 Digestive Aids
 Eczema Treatments
 Elastic Bandages
 Endoscopy
 Erectile Dysfunction Treatment
 Expectorants
 Feminine Anti-Fungal Treatments
 Feminine Hygiene Products
 Fever Reducing Medications
 First Aid Creams
 First Aid Kits
 Fluoroscopy
 Gastric Bypass Surgery
 Genetic Testing
 Glucosamine & Chondroitin
 Glucose Monitoring Equipment
 Guide Dog (for visually/hearing impaired
person), Care and Training
 Headache Medications
 Heart Rate Monitors
 Hearing Aids and Batteries
 Hearing Exams
 Heating Pads
 Hemorrhoidal Preparations
 Immunizations
 Infertility/In-Vitro Treatments
 Incontinence supplies
 Insulin
 Lactation Consultant
 Lasik/Laser and Vision Correction
 Learning Disability (special
 school/teacher)
 Laboratory Fees
 Laxatives
 Lip Products, Medicated
 Lodging for Medical Care (limited)
 Mastectomy related bra
 Medic Alert Bracelet or Necklace
 Medical Records Charges
 Menstrual Pain Relievers
 Menstrual Products and Supplies
 Metabolism Tests
 Midwife Expenses
 Motion Sickness Medications
 MRI
 Neti Pot
 Nasal strips or sprays 
 Nicotine gum, lozenges or patches for
smoking cessation purposes
 Office Visits
 Ovulation Monitor
 Oxygen Equipment
 Pain Relievers
 Patterning Exercises
 PET Scan
 Physical Examination (non-employment
related)
 Physical /Occupational Therapy
 Pedialyte/Rehydration solutions
 Pregnancy test kits
 Prescription Drugs
 Prosthesis
 Respiratory Treatments
 Rolfing
 Sleep Aids and Sedatives
 Smoking Cessation Programs
 Speech Therapy
 Splints/Casts
 Stomach Remedies
 Sunscreen (SPF 30 or higher)
 Support Braces
 Sweat Tests
 Syringes
 Temporary Cord Blood Storage
 Temporary Egg and Sperm Storage (IVF)
 Thermometers
 Throat Lozenges
 Toothache Relievers
 Transplants (including organ donor)
 Transportation Expenses (essential to
medical care)
 Treatment for Handicapped
 Tubal Ligation
 Tuition Fee at Special School for
Disabled Child
 Ultrasound
 Urine/Stool Analyses
 Vaccinations/Immunizations
 Vasectomy
 Visine and other Eye Drops
 Walkers
 Wart Removal
 Well Baby Care
 Wheelchair
 X-rays
 Yeast Infection Medication" 
`;


//"OCR": "OCR text from the receipt",

    let imageData, mimeType;

    if (typeof imagePath === 'string' && imagePath.startsWith('data:')) {
        // Handle base64 encoded image
        [mimeType, imageData] = imagePath.split(',');
        mimeType = mimeType.split(':')[1].split(';')[0];
    } else if (imagePath instanceof File) {
        // Handle File object
        const reader = new FileReader();
        imageData = await new Promise((resolve) => {
            reader.onload = (e) => resolve(e.target.result.split(',')[1]);
            reader.readAsDataURL(imagePath);
        });
        mimeType = imagePath.type;
    } else {
        console.error("Unsupported image format");
        return { response: { text: () => '{"error": "Unsupported image format"}' } };
    }

    const image = {
        inlineData: {
            data: imageData,
            mimeType: mimeType
        },
    };
    
    // Change the order here: pass image first, then prompt
    const result = await model.generateContent([image, prompt]);
    // Log only the text response, not the full result with image
    console.log("Gemini API response text:", result.response.text());
    const rawText = result.response.text();
    
    // Clean and format the JSON properly
    let cleanedText = rawText
        .replace(/```json\n?|\n?```/g, '')  // Remove JSON code blocks
        .replace(/\n\s*/g, '')              // Remove newlines and extra spaces
        .replace(/,\s*]/g, ']')             // Remove trailing commas in arrays
        .replace(/,\s*}/g, '}')             // Remove trailing commas in objects
        .trim();
    
    try {
        // Validate JSON format
        JSON.parse(cleanedText);
        console.log("Valid JSON:", cleanedText);
        return { response: { text: () => cleanedText } };
    } catch (error) {
        console.error("Invalid JSON from Gemini:", error);
        return { 
            response: { 
                text: () => '{"error": "Invalid JSON response from Gemini"}' 
            } 
        };
    }
}
export { run };

