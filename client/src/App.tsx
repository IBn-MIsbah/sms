import { useState } from "react";
import "./App.css";
import { api } from "./services/api-client";

// 1. Define an interface for your data
interface HealthData {
  status: string;
  message: string;
  timestamp: string;
}

function App() {
  // 2. Initialize state as null or an empty object
  const [data, setData] = useState<HealthData | null>(null);
  const [loading, setLoading] = useState<boolean>(false);

  const fetchHealthStatus = async () => {
    setLoading(true);
    try {
      const response = await api.get<HealthData>("/health");
      setData(response.data); // Update everything at once
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-screen w-full flex flex-col items-center justify-center gap-4">
      {/* 3. Use Optional Chaining (?) to avoid errors if data is null */}
      <div className="text-xl font-bold flex flex-col items-center">
        <span>Status: {loading ? "Loading..." : data?.status}</span>
        <span>Message: {loading ? "Loading..." : data?.message}</span>
        <span>Timestamp: {loading ? "Loading..." : data?.timestamp}</span>
      </div>

      <button
        className="px-4 py-2 bg-blue-500 text-white rounded disabled:bg-gray-400"
        onClick={fetchHealthStatus}
        disabled={loading}
      >
        Check Health
      </button>
    </div>
  );
}

export default App;
