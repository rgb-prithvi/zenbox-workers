# Zenbox Workers

A high-performance, distributed email processing system that leverages AI to intelligently classify and organize Gmail messages at scale.

## 🚀 Overview

Zenbox Workers is an enterprise-grade job queue architecture that seamlessly integrates Gmail synchronization with advanced AI classification. Built with TypeScript and BullMQ, it provides robust, scalable email processing capabilities with intelligent error handling and comprehensive monitoring.

## ✨ Key Features

- **Distributed Job Processing**: Leverages BullMQ for reliable, distributed task execution
- **Intelligent Email Classification**: 
  - Multi-tier classification system combining rule-based and AI approaches
  - Automated classification for common email patterns
  - Advanced LLM-powered classification for complex cases
- **Robust Gmail Integration**: 
  - Efficient email synchronization with configurable time windows
  - Smart duplicate detection and rate limiting
- **Enterprise-Ready Infrastructure**:
  - Health check monitoring
  - Graceful shutdown handling
  - Comprehensive error tracking
  - Detailed job logging and metrics
  - Redis-backed job persistence
  - Deployment on Railway 

## 🏗️ Architecture

The system operates through a series of coordinated steps:

1. **Email Synchronization**: 
   - Fetches new emails based on sync type and time window
   - Updates message states and maintains sync history
   
2. **Classification Pipeline**:
   - Initial automated classification for known patterns
   - LLM-powered analysis for complex threads
   - Persistent storage of classification results

3. **Monitoring & Metrics**:
   - Real-time job progress tracking
   - Comprehensive sync metrics collection
   - Detailed error logging and reporting

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
