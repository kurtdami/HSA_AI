# HSA AI Expense Tracker

An intelligent expense tracking system for Health Savings Accounts (HSA) that leverages Multimodal Large Language Models (Google Gemini) to automate receipt analysis and expense categorization. The system significantly reduces manual data entry by automatically extracting and categorizing HSA-eligible items from receipt images, transforming a typically time-consuming process into a seamless, one-click operation.

The AI-powered receipt analysis:
- Automatically identifies HSA-eligible items from receipts
- Extracts key information (date, merchant, prices)
- Validates HSA eligibility based on IRS guidelines
- Reduces manual entry time from minutes to seconds
- Minimizes human error in expense tracking

## Features
- 📸 Receipt scanning with AI analysis
- 🤖 Automatic HSA eligibility detection
- 📊 Expense analytics and visualization
- 📥 Import/Export functionality
- 🔒 Secure Google Authentication
- 💾 Real-time data synchronization

## Tech Stack
- **Frontend**: Next.js, TypeScript, Tailwind CSS
- **Backend**: Express.js, Firebase Admin
- **AI/ML**: Google Gemini API
- **Database**: Firebase Firestore
- **Authentication**: Firebase Authentication (Google Sign-in)
- **Analytics**: Firebase Analytics

## Getting Started
1. Clone the repository
2. Install dependencies: `npm install`
3. Set up environment variables:   ```env
   NEXT_PUBLIC_FIREBASE_CONFIG=...
   FIREBASE_SERVICE_ACCOUNT_KEY=...
   GEMINI_API_KEY=...   ```
4. Run development server: `npm run dev`

## Future Roadmap
- Mobile app development
- Enhanced receipt analysis
- Multi-currency support
- Tax report generation

## License
MIT