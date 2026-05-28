import React, { useState } from 'react';
import axios from 'axios';

const ResumeAppAI = () => {
  const [resumeData, setResumeData] = useState({
    name: '',
    email: '',
    position: '',
    company: '',
    resumeUrl: ''
  });
  const [jobPostingUrl, setJobPostingUrl] = useState('');
  const [aiSuggestions, setAiSuggestions] = useState([]);
  const [loading, setLoading] = useState(false);

  // Function to handle form input changes
  const handleChange = (e) => {
    const { name, value } = e.target;
    setResumeData((prevState) => ({
      ...prevState,
      [name]: value
    }));
  };

  // Function to fetch job posting details from URL
  const getJobPostingDetails = async () => {
    setLoading(true);
    try {
      const response = await axios.get(jobPostingUrl);
      console.log('Job Posting Details:', response.data);
    } catch (error) {
      console.error('Error fetching job posting:', error.message);
    }
    setLoading(false);
  };

  // Function to fetch AI suggestions
  const getAiSuggestions = async () => {
    if (!resumeData.resumeUrl || !jobPostingUrl) return;
    
    try {
      const response = await axios.post('/api/ai-suggestions', {
        resume: resumeData.resumeUrl,
        jobPosting: jobPostingUrl
      });
      setAiSuggestions(response.data);
    } catch (error) {
      console.error('Error fetching AI suggestions:', error.message);
    }
  };

  // Function to submit the application
  const handleSubmit = async () => {
    setLoading(true);
    try {
      await axios.post('/api/resume-applications', resumeData);
      alert('Application submitted successfully!');
    } catch (error) {
      console.error('Error submitting application:', error.message);
    }
    setLoading(false);
  };

  // Function to clear form data
  const handleClearForm = () => {
    setResumeData({
      name: '',
      email: '',
      position: '',
      company: '',
      resumeUrl: ''
    });
    setJobPostingUrl('');
    setAiSuggestions([]);
  };

  return (
    <div>
      <h1 style={{ fontFamily: 'Syne, sans-serif', fontSize: '1rem', fontWeight: 700, color: '#e2e8f0', textTransform: 'uppercase', margin: '0 0 1rem' }}>AI-Assisted Resume Application</h1>
      <form onSubmit={(e) => e.preventDefault()}>
        <label>Name:</label>
        <input type="text" name="name" value={resumeData.name} onChange={handleChange} required />

        <label>Email:</label>
        <input type="email" name="email" value={resumeData.email} onChange={handleChange} required />

        <label>Position:</label>
        <input type="text" name="position" value={resumeData.position} onChange={handleChange} required />

        <label>Company:</label>
        <input type="text" name="company" value={resumeData.company} onChange={handleChange} required />

        <label>Resume URL:</label>
        <input type="url" name="resumeUrl" value={resumeData.resumeUrl} onChange={handleChange} required />

        <label>Job Posting URL:</label>
        <input type="url" name="jobPostingUrl" value={jobPostingUrl} onChange={(e) => setJobPostingUrl(e.target.value)} required />
        
        <button onClick={getJobPostingDetails}>Fetch Job Details</button>

        {loading ? (
          <div>Loading...</div>
        ) : (
          <>
            <button type="submit" onClick={handleSubmit} disabled={!jobPostingUrl || !resumeData.resumeUrl}>
              Submit Application
            </button>
            <button onClick={handleClearForm}>Clear Form</button>
          </>
        )}

        {aiSuggestions.length > 0 && (
          <div>
            <h2>AI Suggestions:</h2>
            <ul>
              {aiSuggestions.map((suggestion, index) => (
                <li key={index}>{suggestion}</li>
              ))}
            </ul>
          </div>
        )}
      </form>
    </div>
  );
};

export default ResumeAppAI;