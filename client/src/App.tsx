import { Routes, Route } from "react-router";

function HomePage() {
  return (
    <div className="p-8">
      <h1 className="text-heading-xl text-content-primary mb-4">
        Recommender System
      </h1>
      <p className="text-body-md text-content-secondary mb-6">
        Welcome to the recommender system client.
      </p>
      <button className="px-4 py-2 bg-action-primary hover:bg-action-primary-hover text-white rounded-md transition-colors">
        Get Started
      </button>
    </div>
  );
}

function App() {
  return (
    <div className="min-h-screen bg-canvas">
      <Routes>
        <Route path="/" element={<HomePage />} />
      </Routes>
    </div>
  );
}

export default App;
