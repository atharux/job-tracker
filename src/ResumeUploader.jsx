import React, { useState } from 'react';
import { Upload, FileText, Loader, AlertCircle, CheckCircle } from 'lucide-react';
import { extractTextFromFile, parseResumeText } from '../utils/smartResumeParser';

/**
 * ResumeUploader Component
 * Handles file upload with drag-and-drop, validation, and smart parsing
 */
export default function ResumeUploader({ onResumeProcessed, isProcessing, setIsProcessing }) {
  const [dragActive, setDragActive] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
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

  /**
   * Validate file type and size
   */
  const validateFile = (file) => {
    const validTypes = [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/plain'
    ];
    
    const validExtensions = ['.pdf', '.docx', '.txt'];
    const fileExtension = file.name.toLowerCase().slice(file.name.lastIndexOf('.'));
    
    if (!validTypes.includes(file.type) && !validExtensions.includes(fileExtension)) {
      return {
        valid: false,
        error: 'Unsupported file format. Please upload a PDF, DOCX, or TXT file.'
      };
    }

    const maxSize = 5 * 1024 * 1024; // 5MB
    if (file.size > maxSize) {
      return {
        valid: false,
        error: 'File too large. Maximum size is 5MB.'
      };
    }

    return { valid: true };
  };

  /**
   * Handle file upload and processing
   */
  const handleFile = async (file) => {
    setError('');
    setSuccess('');
    
    // Validate file
    const validation = validateFile(file);
    if (!validation.valid) {
      setError(validation.error);
      return;
    }

    setIsProcessing(true);

    try {
      // Extract text content
      const text = await extractTextFromFile(file);
      
      if (!text || text.trim().length < 50) {
        throw new Error('Could not extract enough text from the file. Please try a different format.');
      }
      
      // Parse resume using smart parser
      const parseResult = parseResumeText(text);
      
      if (parseResult.success) {
        const { data } = parseResult;
        
        // Check if we got any useful data
        const hasData = 
          (data.experience && data.experience.length > 0) ||
          (data.education && data.education.length > 0) ||
          (data.skills && Object.values(data.skills).some(arr => arr.length > 0));
        
        if (hasData) {
          setSuccess(`Successfully parsed resume! Found ${data.experience?.length || 0} jobs, ${data.education?.length || 0} degrees, and ${Object.values(data.skills).flat().length} skills.`);
          
          onResumeProcessed({
            filename: file.name,
            parsedData: data,
            rawText: text
          });
        } else {
          // Parsing succeeded but found no data - allow manual entry
          setSuccess('Resume uploaded! No structured data found. You can create modules manually below.');
          onResumeProcessed({
            filename: file.name,
            parsedData: null,
            rawText: text,
            allowManualEntry: true
          });
        }
      } else {
        // Parsing failed - allow manual entry
        setSuccess('Resume uploaded! Automatic parsing failed. You can create modules manually below.');
        onResumeProcessed({
          filename: file.name,
          parsedData: null,
          rawText: text,
          allowManualEntry: true,
          message: parseResult.error
        });
      }
    } catch (error) {
      console.error('File processing error:', error);
      setError(error.message || 'Failed to process file. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="resume-uploader-container">
      <div
        className={`resume-uploader ${dragActive ? 'drag-active' : ''} ${error ? 'has-error' : ''} ${success ? 'has-success' : ''}`}
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
              <p className="upload-subtext">Extracting and analyzing content</p>
            </>
          ) : success ? (
            <>
              <CheckCircle className="upload-icon success" size={48} />
              <p className="upload-text">Resume processed!</p>
              <p className="upload-subtext">Review and edit modules below</p>
            </>
          ) : (
            <>
              <Upload className="upload-icon" size={48} />
              <p className="upload-text">Drop resume here or click to upload</p>
              <p className="upload-subtext">Supports PDF, DOCX, TXT (max 5MB)</p>
            </>
          )}
        </label>
      </div>

      {error && (
        <div className="upload-error">
          <AlertCircle size={16} />
          <span>{error}</span>
        </div>
      )}
      
      {success && (
        <div className="upload-success">
          <CheckCircle size={16} />
          <span>{success}</span>
        </div>
      )}
    </div>
  );
}
