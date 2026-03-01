import React, { useState } from 'react';
import { Upload, FileText, Loader } from 'lucide-react';

export default function ResumeUploader({ onResumeProcessed, isProcessing, setIsProcessing }) {
  const [dragActive, setDragActive] = useState(false);

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const handleChange = (e) => {
    e.preventDefault();
    if (e.target.files && e.target.files[0]) {
      handleFile(e.target.files[0]);
    }
  };

  const handleFile = async (file) => {
    // Validate file type
    const validTypes = ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/plain'];
    if (!validTypes.includes(file.type)) {
      alert('Please upload a PDF, DOCX, or TXT file');
      return;
    }

    // Validate file size (5MB max)
    if (file.size > 5 * 1024 * 1024) {
      alert('File too large. Maximum size is 5MB.');
      return;
    }

    setIsProcessing(true);

    try {
      // Read file as text/base64
      const reader = new FileReader();
      
      reader.onload = async (e) => {
        const content = e.target.result;
        
        // Call Claude API to modularize resume
        const response = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "claude-sonnet-4-20250514",
            max_tokens: 4000,
            messages: [
              {
                role: "user",
                content: `Analyze this resume and break it into modular sections. Return ONLY valid JSON with this exact structure:

{
  "summary": "Professional summary text",
  "experience": [
    {
      "company": "Company Name",
      "position": "Job Title",
      "duration": "Start - End",
      "achievements": ["Achievement 1", "Achievement 2"]
    }
  ],
  "skills": {
    "technical": ["skill1", "skill2"],
    "soft": ["skill1", "skill2"]
  },
  "education": [
    {
      "institution": "School Name",
      "degree": "Degree",
      "year": "Year"
    }
  ],
  "certifications": ["cert1", "cert2"]
}

Resume content:
${content.substring(0, 10000)}`
              }
            ]
          })
        });

        const data = await response.json();
        const moduleText = data.content[0].text;
        
        // Extract JSON from response (handle markdown code blocks)
        let jsonText = moduleText;
        if (moduleText.includes('```json')) {
          jsonText = moduleText.split('```json')[1].split('```')[0].trim();
        } else if (moduleText.includes('```')) {
          jsonText = moduleText.split('```')[1].split('```')[0].trim();
        }
        
        const modules = JSON.parse(jsonText);
        
        onResumeProcessed({
          filename: file.name,
          base_content: content,
          modules: modules
        });
      };

      reader.onerror = () => {
        alert('Failed to read file');
        setIsProcessing(false);
      };

      if (file.type === 'application/pdf') {
        reader.readAsDataURL(file);
      } else {
        reader.readAsText(file);
      }
    } catch (error) {
      console.error('Resume processing error:', error);
      alert('Failed to process resume. Please try again.');
      setIsProcessing(false);
    }
  };

  return (
    <div
      className={`resume-uploader ${dragActive ? 'drag-active' : ''}`}
      onDragEnter={handleDrag}
      onDragLeave={handleDrag}
      onDragOver={handleDrag}
      onDrop={handleDrop}
    >
      <input
        type="file"
        id="resume-upload"
        accept=".pdf,.docx,.txt"
        onChange={handleChange}
        disabled={isProcessing}
        style={{ display: 'none' }}
      />
      
      <label htmlFor="resume-upload" className="upload-label">
        {isProcessing ? (
          <>
            <Loader className="upload-icon spinning" size={48} />
            <p className="upload-text">Processing resume...</p>
            <p className="upload-subtext">AI is analyzing and modularizing your content</p>
          </>
        ) : (
          <>
            <FileText className="upload-icon" size={48} />
            <p className="upload-text">Drop resume here or click to upload</p>
            <p className="upload-subtext">Supports PDF, DOCX, TXT (max 5MB)</p>
          </>
        )}
      </label>
    </div>
  );
}
