# Gramedia Kendari Tracker

A robust performance monitoring and revenue reporting system tailored for **Gramedia Kendari**. This application streamlines the tracking of sales targets, daily activities, and member registrations across different organizational levels.

![Banner](./banner.png)

## 🚀 Key Features

### 👥 Role-Based Access Control
*   **Store Manager (SM)**: Manage departments and oversee all user accounts.
*   **Supervisor (SPV)**: Assign associates, set monthly targets, and verify revenue data.
*   **Store Associate (SA)**: Input daily revenue, activity reports, and Waqaf member data.

### 📊 Monitoring & Reporting
*   **Real-time Dashboards**: Visual analytics using ApexCharts and Recharts.
*   **Comprehensive Reports**: Daily recaps, activity logs, and monthly performance tracking.
*   **Data Export**: Generate professional reports in PDF format for archiving and sharing.

### 🔐 Secure & Scalable
*   Integrated with **Supabase** for secure authentication and reliable data storage.
*   Built with a modern, responsive UI using **Tailwind CSS v4**.

## 🛠️ Tech Stack

*   **Frontend**: React 19, TypeScript, Vite
*   **Styling**: Tailwind CSS v4
*   **State Management**: Zustand
*   **Backend & Auth**: Supabase
*   **Charts**: ApexCharts, Recharts
*   **Utilities**: Lucide React (Icons), Flatpickr (Date Picker), jsPDF (PDF Generation)

## ⚙️ Quick Setup

1.  **Clone the Repository**:
    ```bash
    git clone https://github.com/ilhamsetiawanz/reportgramedia.git
    cd gramedia-kendari-tracker
    ```

2.  **Install Dependencies**:
    ```bash
    npm install
    ```

3.  **Environment Variables**:
    Create a `.env` file in the root directory and add your Supabase credentials:
    ```env
    VITE_SUPABASE_URL=your_supabase_url
    VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
    ```

4.  **Run Development Server**:
    ```bash
    npm run dev
    ```

## 📄 License
This project is private and intended for use by Gramedia Kendari.
