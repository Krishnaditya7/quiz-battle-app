function App() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-500 via-purple-500 to-pink-500 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full">
        <div className="text-center">
          <h1 className="text-5xl font-bold text-gray-800 mb-2">
            Quiz Battle Arena
          </h1>
          <p className="text-2xl mb-4">🎮📚⚔️</p>
          <p className="text-gray-600 text-lg mb-6">
            Study Smart, Play Hard, No Guilt!
          </p>
          
          <div className="space-y-4">
            <button className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-6 rounded-lg transition duration-300 transform hover:scale-105">
              Get Started
            </button>
            
            <button className="w-full bg-purple-600 hover:bg-purple-700 text-white font-bold py-3 px-6 rounded-lg transition duration-300 transform hover:scale-105">
              View Leaderboard
            </button>
          </div>
          
          <div className="mt-8 pt-6 border-t border-gray-200">
            <p className="text-sm text-gray-500">
              Join thousands of students who turned studying into a game!
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;