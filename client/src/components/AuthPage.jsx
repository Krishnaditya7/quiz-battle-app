import React, { useState } from 'react';
import axios from 'axios';
import { useNavigate } from "react-router-dom";
import { BACKEND_URL } from '../config';

export default function AuthPage({ setUser }) {
  const navigate = useNavigate();

  const [isLogin, setIsLogin] = useState(false);
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    dob: '',
    className: '',
    topics: []
  });
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [showClassDropdown, setShowClassDropdown] = useState(false);
  const [showTopicsDropdown, setShowTopicsDropdown] = useState(false);

  const classes = ['6', '7', '8', '9', '10', '11', '12', 'College', 'Other'];
  
  const allTopics = ['JavaScript',
'Python',
'Java',
'C++',
'Data Structures',
'Algorithms',
  
// School Subjects
'Mathematics',
'Physics',
'Chemistry',
'Biology',
'History',
'Geography',
'English',
'Hindi',
  
// Other
'General Knowledge',
'Current Affairs',
'Science',
'Technology',
'Sports',
'Movies',
'Music']

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    // Clear error for this field
    if (errors[e.target.name]) {
      setErrors({ ...errors, [e.target.name]: '' });
    }
  };

  const handleClassSelect = (cls) => {
    setFormData({ ...formData, className: cls });
    setShowClassDropdown(false);
    if (errors.className) {
      setErrors({ ...errors, className: '' });
    }
  };

  const handleTopicToggle = (topic) => {
    const newTopics = formData.topics.includes(topic)
      ? formData.topics.filter(t => t !== topic)
      : [...formData.topics, topic];
    setFormData({ ...formData, topics: newTopics });
    if (errors.topics) {
      setErrors({ ...errors, topics: '' });
    }
  };

  const validate = () => {
    const newErrors = {};

    if (!isLogin) {
      if (!formData.username.trim()) newErrors.username = 'Username required';
      if (formData.username.length < 3) newErrors.username = 'Username must be 3+ characters';
      if (!formData.dob) newErrors.dob = 'Date of birth required';
      if (!formData.className) newErrors.className = 'Class required';
      if (formData.topics.length === 0) newErrors.topics = 'Select at least 1 topic';
    }

    if (!formData.email.trim()) newErrors.email = 'Email required';
    if (!/\S+@\S+\.\S+/.test(formData.email)) newErrors.email = 'Invalid email';
    if (!formData.password) newErrors.password = 'Password required';
    if (formData.password.length < 6) newErrors.password = 'Password must be 6+ characters';

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;

    setLoading(true);
    try {
      const endpoint = isLogin ? '/api/auth/login' : '/api/auth/signup';
      const payload = isLogin 
        ? { emailOrUsername: formData.email, password: formData.password }
        : formData;

      await axios.post(`${BACKEND_URL}${endpoint}`, payload, {
        withCredentials: true
      });
     const profileRes = await axios.get(
      `${BACKEND_URL}/api/auth/me`,
      { withCredentials: true }
    );

    if (profileRes.data.user) {
      setUser(profileRes.data.user);// Ideally lift this to global context
      localStorage.setItem('user', JSON.stringify(profileRes.data.user));
      navigate("/dashboard");
    }
    } catch (err) {
      setErrors({ 
        submit: err.response?.data?.message || 'Something went wrong' 
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-purple-950 to-slate-900 flex items-center justify-center p-6 relative overflow-hidden">
      {/* Animated Background Elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 left-20 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-20 right-20 w-96 h-96 bg-pink-500/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
        <div className="absolute top-1/2 left-1/2 w-64 h-64 bg-orange-500/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '0.5s' }} />
      </div>

      {/* Auth Card */}
      <div className="relative w-full max-w-md">
        {/* Logo/Brand */}
        <div className="text-center mb-8">
          <h1 className="text-5xl font-black bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent mb-2">
            QUIZ BATTLE
          </h1>
          <p className="text-slate-400">
            {isLogin ? 'Welcome back, warrior' : 'Join the battle'}
          </p>
        </div>

        {/* Card */}
        <div className="bg-slate-900/80 backdrop-blur-xl border border-purple-500/20 rounded-3xl p-8 shadow-2xl relative">
          {/* Toggle Login/Signup */}
          <div className="flex gap-2 mb-8 bg-slate-800/50 p-1 rounded-2xl">
            <button
              onClick={() => setIsLogin(false)}
              className={`flex-1 py-3 rounded-xl font-bold transition-all duration-300 ${
                !isLogin 
                  ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-lg' 
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Sign Up
            </button>
            <button
              onClick={() => setIsLogin(true)}
              className={`flex-1 py-3 rounded-xl font-bold transition-all duration-300 ${
                isLogin 
                  ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-lg' 
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Login
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Username (Signup only) */}
            {!isLogin && (
              <div className="space-y-2">
                <label className="text-sm font-semibold text-purple-300">
                  Username *
                </label>
                <input
                  type="text"
                  name="username"
                  value={formData.username}
                  onChange={handleChange}
                  placeholder="Enter your username"
                  className={`w-full px-4 py-3 bg-slate-800/50 border ${
                    errors.username ? 'border-red-500' : 'border-slate-700'
                  } rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 transition-all`}
                />
                {errors.username && (
                  <p className="text-red-400 text-sm flex items-center gap-1">
                    <span>⚠</span> {errors.username}
                  </p>
                )}
              </div>
            )}

            {/* Email */}
            <div className="space-y-2">
              <label className="text-sm font-semibold text-purple-300">
                {isLogin ? 'Email or Username' : 'Email'} *
              </label>
              <input
                type={isLogin ? 'text' : 'email'}
                name="email"
                value={formData.email}
                onChange={handleChange}
                placeholder={isLogin ? 'Email or username' : 'Enter your email'}
                className={`w-full px-4 py-3 bg-slate-800/50 border ${
                  errors.email ? 'border-red-500' : 'border-slate-700'
                } rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 transition-all`}
              />
              {errors.email && (
                <p className="text-red-400 text-sm flex items-center gap-1">
                  <span>⚠</span> {errors.email}
                </p>
              )}
            </div>

            {/* Password */}
            <div className="space-y-2">
              <label className="text-sm font-semibold text-purple-300">
                Password *
              </label>
              <input
                type="password"
                name="password"
                value={formData.password}
                onChange={handleChange}
                placeholder="Enter your password"
                className={`w-full px-4 py-3 bg-slate-800/50 border ${
                  errors.password ? 'border-red-500' : 'border-slate-700'
                } rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 transition-all`}
              />
              {errors.password && (
                <p className="text-red-400 text-sm flex items-center gap-1">
                  <span>⚠</span> {errors.password}
                </p>
              )}
            </div>

            {/* Date of Birth (Signup only) */}
            {!isLogin && (
              <div className="space-y-2">
                <label className="text-sm font-semibold text-purple-300">
                  Date of Birth *
                </label>
                <input
                  type="date"
                  name="dob"
                  value={formData.dob}
                  onChange={handleChange}
                  max={new Date().toISOString().split('T')[0]}
                  className={`w-full px-4 py-3 bg-slate-800/50 border ${
                    errors.dob ? 'border-red-500' : 'border-slate-700'
                  } rounded-xl text-white focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 transition-all`}
                />
                {errors.dob && (
                  <p className="text-red-400 text-sm flex items-center gap-1">
                    <span>⚠</span> {errors.dob}
                  </p>
                )}
              </div>
            )}

            {/* Class Dropdown (Signup only) */}
            {!isLogin && (
              <div className="space-y-2 relative">
                <label className="text-sm font-semibold text-purple-300">
                  Class *
                </label>
                <button
                  type="button"
                  onClick={() => setShowClassDropdown(!showClassDropdown)}
                  className={`w-full px-4 py-3 bg-slate-800/50 border ${
                    errors.className ? 'border-red-500' : 'border-slate-700'
                  } rounded-xl text-left text-white focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 transition-all flex items-center justify-between`}
                >
                  <span className={formData.className ? 'text-white' : 'text-slate-500'}>
                    {formData.className ? `${formData.className}` : 'Select your class'}
                  </span>
                  <span className={`transition-transform duration-300 ${showClassDropdown ? 'rotate-180' : ''}`}>
                    ▼
                  </span>
                </button>
                
                {showClassDropdown && (
                  <div className="absolute z-20 w-full mt-2 bg-slate-800 border border-purple-500/30 rounded-xl shadow-2xl max-h-64 overflow-y-auto">
                    {classes.map(cls => (
                      <button
                        key={cls}
                        type="button"
                        onClick={() => handleClassSelect(cls)}
                        className={`w-full px-4 py-3 text-left hover:bg-purple-600/20 transition-colors ${
                          formData.className === cls ? 'bg-purple-600/30 text-purple-300' : 'text-white'
                        } first:rounded-t-xl last:rounded-b-xl`}
                      >
                         {cls}
                      </button>
                    ))}
                  </div>
                )}
                
                {errors.className && (
                  <p className="text-red-400 text-sm flex items-center gap-1">
                    <span>⚠</span> {errors.className}
                  </p>
                )}
              </div>
            )}

            {/* Topics Multi-Select (Signup only) */}
            {!isLogin && (
              <div className="space-y-2 relative">
                <label className="text-sm font-semibold text-purple-300">
                  Favorite Topics * (Select multiple)
                </label>
                <button
                  type="button"
                  onClick={() => setShowTopicsDropdown(!showTopicsDropdown)}
                  className={`w-full px-4 py-3 bg-slate-800/50 border ${
                    errors.topics ? 'border-red-500' : 'border-slate-700'
                  } rounded-xl text-left text-white focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 transition-all flex items-center justify-between`}
                >
                  <span className={formData.topics.length > 0 ? 'text-white' : 'text-slate-500'}>
                    {formData.topics.length > 0 
                      ? `${formData.topics.length} topic${formData.topics.length > 1 ? 's' : ''} selected` 
                      : 'Select topics'}
                  </span>
                  <span className={`transition-transform duration-300 ${showTopicsDropdown ? 'rotate-180' : ''}`}>
                    ▼
                  </span>
                </button>

                {formData.topics.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {formData.topics.map(topic => (
                      <span
                        key={topic}
                        className="px-3 py-1 bg-purple-600/30 border border-purple-500/50 rounded-full text-sm text-purple-300 flex items-center gap-2"
                      >
                        {topic}
                        <button
                          type="button"
                          onClick={() => handleTopicToggle(topic)}
                          className="hover:text-white transition-colors"
                        >
                          ✕
                        </button>
                      </span>
                    ))}
                  </div>
                )}
                
                {showTopicsDropdown && (
                  <div className="absolute z-20 w-full mt-2 bg-slate-800 border border-purple-500/30 rounded-xl shadow-2xl max-h-64 overflow-y-auto">
                    {allTopics.map(topic => (
                      <button
                        key={topic}
                        type="button"
                        onClick={() => handleTopicToggle(topic)}
                        className={`w-full px-4 py-3 text-left hover:bg-purple-600/20 transition-colors ${
                          formData.topics.includes(topic) ? 'bg-purple-600/30 text-purple-300' : 'text-white'
                        } first:rounded-t-xl last:rounded-b-xl flex items-center justify-between`}
                      >
                        {topic}
                        {formData.topics.includes(topic) && (
                          <span className="text-purple-400">✓</span>
                        )}
                      </button>
                    ))}
                  </div>
                )}
                
                {errors.topics && (
                  <p className="text-red-400 text-sm flex items-center gap-1">
                    <span>⚠</span> {errors.topics}
                  </p>
                )}
              </div>
            )}

            {/* Submit Error */}
            {errors.submit && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 text-red-400 text-sm">
                {errors.submit}
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-4 bg-gradient-to-r from-purple-600 to-pink-600 rounded-xl font-bold text-lg hover:scale-[1.02] transition-all duration-300 hover:shadow-2xl hover:shadow-purple-500/50 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  {isLogin ? 'Logging in...' : 'Creating account...'}
                </span>
              ) : (
                isLogin ? 'LOGIN' : 'CREATE ACCOUNT'
              )}
            </button>
          </form>

          {/* Forgot Password (Login only) */}
          {isLogin && (
            <div className="mt-6 text-center">
              <button className="text-sm text-purple-400 hover:text-purple-300 transition-colors">
                Forgot password?
              </button>
            </div>
          )}
        </div>

        {/* Footer Text */}
        <p className="text-center text-slate-500 text-sm mt-6">
          {isLogin ? "Don't have an account? " : "Already have an account? "}
          <button
            onClick={() => setIsLogin(!isLogin)}
            className="text-purple-400 hover:text-purple-300 font-semibold transition-colors"
          >
            {isLogin ? 'Sign up' : 'Login'}
          </button>
        </p>
      </div>
    </div>
  );
}