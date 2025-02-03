# Zenbox Workers

A distributed email processing system using AI to classify and organize Gmail messages. Built as the backend worker infrastructure for a larger email management system. Check out [Zenbox](https://zen-inbox.vercel.app/) to see the complete product vision.

## 🚀 Overview

Built with TypeScript and BullMQ, this system handles email processing at scale with robust error handling and comprehensive monitoring. It powers the backend for a companion Next.js email client (private repository), creating a complete email management solution.

## ✨ Key Features

- **Distributed Processing**: BullMQ for reliable task execution
- **AI-Powered Classification**: 
  - Rule-based and ML classification pipeline
  - Pattern matching for common cases
  - LLM analysis for complex threads
- **Gmail Integration**: 
  - Efficient sync with rate limiting
  - Duplicate detection
- **Production Infrastructure**:
  - Health monitoring
  - Graceful shutdown
  - Error tracking
  - Metrics and logging
  - Redis persistence
  - Railway deployment

## 🏗️ Architecture

The system operates through a series of coordinated steps:

1. **Email Synchronization**: 
   - Fetches new emails based on sync type and time window
   - Updates message states and maintains sync history
   
2. **Classification Pipeline**:
   - Initial automated classification for known patterns
   - LLM-powered analysis for complex threads
   - Persistent storage of classification results
   
3. **Frontend Integration**:
   - Exposes processed data to companion Next.js application (read from Supabase DB backend)

## 🛠️ Technology Stack

- **Core**: TypeScript, Node.js
- **Queue Management**: BullMQ
- **Database**: Supabase
- **Caching**: Redis
- **AI/ML**: Vercel AI SDK + OpenAI GPT 4o mini
- **API Integration**: Gmail API


## 🚀 Getting Started

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```
3. Configure environment variables:
   ```bash
   cp .env.example .env
   ```
4. Start the worker:
   ```bash
   npm run start
   ```

## 📝 License

[MIT License](LICENSE)

---

Built with ❤️ using modern TypeScript and cutting-edge AI technology.
