import React, { useState } from 'react';
import { Upload, Loader, AlertCircle, CheckCircle, Info, ArrowDown } from 'lucide-react';
import { extractTextFromFile, parseResumeText } from '../utils/smartResumeParser';

/**
 * ResumeUploader Component
 * Handles file upload with drag-and-drop, validation, and smart parsing
 */
export default function ResumeUploader({ onResumeProcessed, isProcessing, setIsProcessing }) {
  const [dragActive, setDragActive] = useState(false);
  const [error, setError] = useState('');
  const [uploadResult, setUploadResult] = useState(null); // 'success', 'partial', 'manual'

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
    setUploadResult(null);
    
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
        throw new Error('Could not extract enough text from the file. Please try a different format or create modules manually.');
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
          setUploadResult({
            type: 'success',
            filename: file.name,
            stats: {
              jobs: data.experience?.length || 0,
              degrees: data.education?.length || 0,
              skills: Object.values(data.skills).flat().length
            }
          });
          
          onResumeProcessed({
            filename: file.name,
            parsedData: data,
            rawText: text
          });
        } else {
          // Parsing succeeded but found no data
          setUploadResult({
            type: 'manual',
            filename: file.name,
            reason: 'no-data'
          });
          
          onResumeProcessed({
            filename: file.name,
            parsedData: null,
            rawText: text,
            allowManualEntry: true
          });
        }
      } else {
        // Parsing failed
        setUploadResult({
          type: 'manual',
          filename: file.name,
          reason: 'parse-failed'
        });
        
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
        className={`resume-uploader ${dragActive ? 'drag-active' : ''} ${error ? 'has-error' : ''} ${uploadResult ? 'has-result' : ''}`}
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
              <p className="upload-text">Processing {uploadResult?.filename || 'resume'}...</p>
              <p className="upload-subtext">Extracting and analyzing content</p>
            </>
          ) : uploadResult ? (
            <>
              {uploadResult.type === 'success' ? (
                <>
                  <CheckCircle className="upload-icon success" size={48} />
                  <p className="upload-text">✓ Successfully parsed!</p>
                  <p className="upload-subtext">
                    Found {uploadResult.stats.jobs} jobs, {uploadResult.stats.degrees} degrees, {uploadResult.stats.skills} skills
                  </p>
                </>
              ) : (
                <>
                  <Info className="upload-icon info" size={48} />
                  <p className="upload-text">Resume uploaded: {uploadResult.filename}</p>
                  <p className="upload-subtext">Ready for manual module creation</p>
                </>
              )}
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
      
      {uploadResult && uploadResult.type === 'manual' && (
        <div className="upload-info-box">
          <div className="info-header">
            <Info size={20} />
            <h4>Automatic parsing couldn't extract your resume sections</h4>
          </div>
          <p className="info-message">
            {uploadResult.reason === 'no-data' 
              ? "We couldn't identify standard resume sections (Experience, Education, Skills) in your file. This often happens with PDFs that have complex formatting."
              : "Your resume format couldn't be automatically parsed. This is common with certain PDF layouts."}
          </p>
          <div className="info-next-steps">
            <p className="next-steps-title">Next steps:</p>
            <ol>
              <li>Click the <strong>"NEW MODULE"</strong> button below</li>
              <li>Choose a module type (Experience, Education, Skills, etc.)</li>
              <li>Copy and paste content from your resume</li>
              <li>Repeat for each section</li>
            </ol>
          </div>
          <div className="info-arrow">
            <ArrowDown size={24} className="bounce" />
            <span>Click "NEW MODULE" or "CREATE YOUR FIRST MODULE" below</span>
          </div>
        </div>
      )}
      
      {uploadResult && uploadResult.type === 'success' && (
        <div className="upload-success-box">
          <CheckCircle size={20} />
          <p>Modules created successfully! Review and edit them below, then create a resume version.</p>
        </div>
      )}
    </div>
  );
}
