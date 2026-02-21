SoundGuard AI - Complete Cursor AI Development Prompt
Project Overview Prompt
Create a MERN stack application called "SoundGuard AI" - an intelligent audio analysis and enhancement system.

TECH STACK:
- Frontend: React with Tailwind CSS
- Backend: Node.js with Express.js
- Database: MongoDB
- AI Integration: Python microservices (PyTorch/TensorFlow)
- Audio Processing: Librosa, FFmpeg, Torchaudio

PROJECT STRUCTURE:
The application has ONE main page that displays all audio information, with FOUR MODULE BUTTONS that each open different audio analysis operations.

MAIN PAGE FEATURES:
1. Audio upload section (drag & drop or file browser)
2. Audio waveform visualization
3. Basic audio information display (duration, format, sample rate, file size)
4. Audio player controls (play, pause, stop, volume)
5. Four module buttons for different operations

FOUR MODULES (Each opens as modal or separate section):
1. Audio Enhancement (AI-based denoising)
2. Explainable Noise Removal (shows what AI removed and why)
3. Audio Quality Index (AQI scoring 0-100)
4. Tampering Detection (forensic analysis)

DESIGN REQUIREMENTS:
- Clean, professional white background
- Modern UI with smooth transitions
- Responsive design (desktop and mobile)
- Real-time progress indicators
- Clear visual feedback for all operations


############################################

Detailed Module Prompts
1. Main Dashboard Page Prompt

Create the main dashboard page for SoundGuard AI with the following components:

LAYOUT:
- Header: "SoundGuard AI - Intelligent Audio Analysis System"
- Subheader: "Upload audio to analyze, enhance, and verify authenticity"

AUDIO UPLOAD SECTION:
- Large drag-and-drop area with border-dashed styling
- "Upload Audio File" button as alternative
- Supported formats: .wav, .mp3, .flac, .ogg, .m4a
- Max file size: 50MB
- Show upload progress bar during upload
- Display success message with file name after upload

AUDIO INFORMATION CARD (appears after upload):
Display in a clean card with the following info:
- File Name: [filename.mp3]
- Duration: [MM:SS]
- Format: [MP3/WAV/etc]
- Sample Rate: [44100 Hz]
- Channels: [Stereo/Mono]
- Bitrate: [320 kbps]
- File Size: [5.2 MB]

WAVEFORM VISUALIZATION:
- Display audio waveform using WaveSurfer.js or similar
- Interactive waveform (click to seek)
- Current playback position indicator
- Zoom in/out controls

AUDIO PLAYER CONTROLS:
- Play/Pause button (toggle)
- Stop button
- Current time / Total duration display
- Volume slider (0-100%)
- Playback speed control (0.5x, 1x, 1.5x, 2x)

FOUR MODULE BUTTONS (Grid layout 2x2):
Each button should be a large card with:
- Icon representing the module
- Module name as heading
- Brief description (1 line)
- "Launch Module" button

Button 1: AI-Based Audio Enhancement
Icon: 🎨
Description: "Remove noise and enhance audio quality using deep learning"

Button 2: Explainable Noise Removal  
Icon: 🔍
Description: "See what AI removed and understand the denoising process"

Button 3: Audio Quality Index (AQI)
Icon: 📊
Description: "Get real-time quality score and detailed metrics"

Button 4: Tampering Detection
Icon: 🛡️
Description: "Detect splices, edits, and audio manipulation"

STYLING:
- Use Tailwind CSS utility classes
- White background with subtle gray borders
- Primary color: Blue (#007bff)
- Hover effects on all interactive elements
- Shadow on cards for depth
- Responsive grid (stack on mobile)


#######################################

2. Module 1: AI-Based Audio Enhancement
Create a modal/section for "AI-Based Audio Enhancement" module:

MODAL HEADER:
- Title: "AI-Based Audio Enhancement"
- Close button (X) in top-right
- Subtitle: "Remove noise using state-of-the-art deep learning models"

MODEL SELECTION:
Radio buttons or dropdown to select enhancement model:
- DEMUCS (Music Source Separation)
- CleanUNet (Real-time Speech Denoising)
- FullSubNet+ (Advanced Speech Enhancement)
- Default: CleanUNet

SETTINGS PANEL:
- Noise Reduction Strength: Slider 0-100% (default: 80%)
- Preserve Speech: Toggle ON/OFF (default: ON)
- Processing Mode: Fast / Balanced / Quality

PROCESS SECTION:
- "Enhance Audio" button (primary, large)
- Progress bar showing processing status
- Estimated time remaining
- Cancel button during processing

RESULTS SECTION (after processing):
Two-column comparison:

LEFT: Original Audio
- Waveform of original
- Play button
- Download original button

RIGHT: Enhanced Audio
- Waveform of enhanced audio
- Play button
- Download enhanced button

IMPROVEMENT METRICS:
Display in card format:
- Noise Reduced: [45 dB]
- SNR Improvement: [+15 dB]
- Speech Clarity: [+23%]
- Processing Time: [3.2 seconds]

ACTION BUTTONS:
- "Apply Enhancement" (save and use enhanced version)
- "Try Different Model"
- "Reset to Original"
- "Close Module"

TECHNICAL IMPLEMENTATION:
- Send audio file to backend API endpoint: POST /api/enhance
- Backend calls Python microservice with selected model
- Return enhanced audio as blob
- Update waveform visualization
- Enable download functionality


#####################################
3. Module 2: Explainable Noise Removal

Create a modal/section for "Explainable Noise Removal" module:

MODAL HEADER:
- Title: "Explainable Noise Removal"
- Subtitle: "Understand what AI removed and why"

VISUALIZATION SECTION:
BEFORE-AFTER SPECTROGRAM COMPARISON:

Top Half: Original Audio Spectrogram
- Frequency (Hz) on Y-axis, Time (s) on X-axis
- Color-coded intensity (blue=low, red=high)
- Highlight noise regions with red overlay boxes

Bottom Half: Enhanced Audio Spectrogram
- Same axes and color scheme
- Show removed noise regions as transparent/grayed out

EXPLANATION PANEL (Right side or below):
Display detected noise types in card format:

Card 1: Background Noise
Icon: 🎤
- Type: Traffic Sound
- Frequency Range: 100-500 Hz
- Time Range: 2.3s - 3.1s
- Reduction: 45 dB removed
- Confidence: 94%

Card 2: Electrical Hiss
Icon: 📻
- Type: High-frequency Interference
- Frequency Range: 8 kHz - 12 kHz
- Time Range: Throughout audio
- Reduction: 80% removed
- Confidence: 89%

Card 3: Speech Preservation
Icon: 🔊
- Type: Voice Frequencies
- Frequency Range: 300 Hz - 3 kHz
- Status: 100% Preserved
- Quality: Excellent

INTERACTIVE FEATURES:
- Hover over noise regions to see details
- Click noise cards to highlight on spectrogram
- Toggle between original/enhanced view
- Play specific time segments

PROCESS BUTTON:
- "Analyze & Explain" button
- Shows loading spinner during analysis
- Generates visual explanations

ACTION BUTTONS:
- "Download Report" (PDF with explanations)
- "Apply Changes"
- "Close Module"

TECHNICAL IMPLEMENTATION:
- API endpoint: POST /api/explain-denoising
- Use GradCAM or attention maps for visualization
- Return noise detection results as JSON
- Use Plotly or D3.js for interactive spectrograms
- Generate downloadable report


#############################
4. Module 3: Audio Quality Index (AQI)
Create a modal/section for "Audio Quality Index (AQI)" module:

MODAL HEADER:
- Title: "Audio Quality Index (AQI)"
- Subtitle: "Real-time quality assessment with standardized metrics"

AQI SCORE DISPLAY (Center, Large):
- Circular progress indicator (0-100)
- Current score in center (e.g., "87")
- Color-coded:
  - 0-40: Red (Poor)
  - 41-70: Yellow (Fair)
  - 71-100: Green (Good)
- Label: "Overall Audio Quality"

QUALITY METER (Below score):
- Horizontal bar with gradient (red → yellow → green)
- Pointer indicating current score position
- Labels: "Poor (0-40)" | "Fair (41-70)" | "Good (71-100)"

DETAILED METRICS (Grid layout 2x3):

Metric 1: Signal-to-Noise Ratio (SNR)
- Icon: 📡
- Value: 35.2 dB
- Status: Good (green check)
- Progress bar

Metric 2: Clarity
- Icon: 🔊
- Value: 92%
- Status: Excellent (green check)
- Progress bar

Metric 3: Distortion
- Icon: ⚠️
- Value: 0.3%
- Status: Excellent (green check)
- Progress bar

Metric 4: Frequency Response
- Icon: 📶
- Value: Excellent
- Status: Good (green check)
- Mini frequency chart

Metric 5: Dynamic Range
- Icon: 🎚️
- Value: 78 dB
- Status: Good (green check)
- Progress bar

Metric 6: Noise Floor
- Icon: 🔇
- Value: -65 dB
- Status: Excellent (green check)
- Progress bar

REAL-TIME MONITORING:
- Toggle: "Enable Live Monitoring"
- Updates metrics every 2 seconds during playback
- Shows waveform with quality overlay
- Timeline showing quality variations

COMPARISON MODE:
If enhanced audio exists:
- Side-by-side comparison table
- Show improvement for each metric
- Highlight improvements in green
- Show degradation in red (if any)

ACTION BUTTONS:
- "Re-calculate AQI"
- "Download Quality Report"
- "Compare Versions"
- "Close Module"

TECHNICAL IMPLEMENTATION:
- API endpoint: POST /api/calculate-aqi
- Use DNSMOS or similar for quality scoring
- Calculate all 6 metrics using Librosa
- Return JSON with scores and recommendations
- Real-time updates using WebSocket for live monitoring


##################################
5. Module 4: Tampering Detection (Forensics)

Create a modal/section for "Tampering Detection" module:

MODAL HEADER:
- Title: "Audio Tampering Detection"
- Subtitle: "Forensic analysis to detect cuts, splices, and manipulation"

AUTHENTICITY SCORE (Top section):
Large card with:
- Score: 56/100
- Status badge: "MODIFIED" (red) or "AUTHENTIC" (green)
- Risk level: Low / Medium / High / Critical
- Visual indicator (shield icon with color)

TIMELINE VISUALIZATION:
Interactive timeline showing audio duration:
- Green sections: Authentic/unmodified
- Red sections: Tampered/suspicious
- Yellow sections: Uncertain

Markers on timeline for each detection:
- Splice at 3.2s (red warning icon)
- Edit at 5.8s (red warning icon)
- Hover to see details

DETECTION RESULTS (List format):

Detection 1 Card:
- Icon: ⚠️ (red)
- Type: Splice Detected
- Location: 3.2 seconds
- Description: "Abrupt frequency discontinuity"
- Confidence: 94%
- Severity: High
- Details button (expands for technical info)

Detection 2 Card:
- Icon: ⚠️ (red)
- Type: Edit Detected
- Location: 5.8 seconds
- Description: "Phase mismatch and waveform inconsistency"
- Confidence: 89%
- Severity: Medium
- Details button

Analysis Summary Card:
- Icon: ℹ️ (blue)
- Conclusion: "Audio appears to be edited. Two segments joined together."
- Number of tampering instances: 2
- Total tampered duration: 1.4 seconds
- Recommendation: "Not suitable as authentic evidence"

TECHNICAL ANALYSIS (Expandable section):
Show detailed forensic data:
- ENF (Electric Network Frequency) Analysis
- Phase continuity graph
- Frequency consistency chart
- Waveform comparison at splice points

FORENSIC REPORT:
- Tampering probability: 94%
- Analysis method: RawNet3 Deep Learning
- Processing time: 8.3 seconds
- Dataset reference: ASVspoof 2021

ACTION BUTTONS:
- "Detailed Forensic Report" (download PDF)
- "Export Timeline"
- "Mark as Reviewed"
- "Close Module"

VISUAL INDICATORS:
If authentic (score > 85):
- Green background
- Checkmark icon
- "Audio is authentic and unmodified"

If tampered (score < 70):
- Red/yellow background
- Warning icon
- "Tampering detected - not suitable for evidence"

TECHNICAL IMPLEMENTATION:
- API endpoint: POST /api/detect-tampering
- Use RawNet3 model for deepfake/splice detection
- ENF analysis for authenticity verification
- Return detection results as JSON array
- Generate visual timeline using D3.js or Chart.js
- Create downloadable forensic report PDF



#################################
Backend API Structure Prompt

Create Node.js/Express backend with the following API endpoints:

FOLDER STRUCTURE:
/server
  /routes
    - audioRoutes.js
  /controllers
    - audioController.js
  /models
    - Audio.js
  /services
    - pythonService.js (calls Python microservices)
  /middleware
    - upload.js (multer for file upload)
    - errorHandler.js
  /utils
    - fileProcessor.js
  - server.js

API ENDPOINTS:

1. POST /api/upload
   - Accept audio file upload
   - Validate file type and size
   - Save to /uploads directory
   - Extract metadata using ffprobe
   - Save record to MongoDB
   - Return audio ID and metadata

2. POST /api/enhance
   - Body: { audioId, model, settings }
   - Call Python microservice for enhancement
   - Save enhanced audio
   - Return enhanced audio URL and metrics

3. POST /api/explain-denoising
   - Body: { audioId }
   - Call Python service with explainability module
   - Generate spectrogram comparisons
   - Return noise detection results and visualizations

4. POST /api/calculate-aqi
   - Body: { audioId }
   - Calculate 6 quality metrics
   - Return AQI score (0-100) and detailed metrics

5. POST /api/detect-tampering
   - Body: { audioId }
   - Run RawNet3 forensic analysis
   - Detect splices, edits, manipulations
   - Return authenticity score and detection results

6. GET /api/audio/:id
   - Return audio file metadata
   - Include processing history
   - Return download URLs

7. DELETE /api/audio/:id
   - Delete audio file and associated data
   - Clean up processed versions

MONGODB SCHEMA:

Audio Model:
{
  filename: String,
  originalPath: String,
  enhancedPath: String,
  format: String,
  duration: Number,
  sampleRate: Number,
  channels: Number,
  fileSize: Number,
  uploadDate: Date,
  
  metadata: {
    bitrate: Number,
    codec: String
  },
  
  processing: {
    enhanced: Boolean,
    enhancementModel: String,
    aqiScore: Number,
    authenticityScore: Number,
    tamperingDetected: Boolean
  },
  
  results: {
    enhancement: Object,
    explainability: Object,
    aqi: Object,
    forensics: Object
  }
}

ERROR HANDLING:
- Use try-catch for all async operations
- Return proper HTTP status codes
- Provide clear error messages
- Log errors to console/file

CORS CONFIGURATION:
- Allow requests from React frontend
- Enable credentials
- Allow methods: GET, POST, DELETE




###############################
Create Node.js/Express backend with the following API endpoints:

FOLDER STRUCTURE:
/server
  /routes
    - audioRoutes.js
  /controllers
    - audioController.js
  /models
    - Audio.js
  /services
    - pythonService.js (calls Python microservices)
  /middleware
    - upload.js (multer for file upload)
    - errorHandler.js
  /utils
    - fileProcessor.js
  - server.js

API ENDPOINTS:

1. POST /api/upload
   - Accept audio file upload
   - Validate file type and size
   - Save to /uploads directory
   - Extract metadata using ffprobe
   - Save record to MongoDB
   - Return audio ID and metadata

2. POST /api/enhance
   - Body: { audioId, model, settings }
   - Call Python microservice for enhancement
   - Save enhanced audio
   - Return enhanced audio URL and metrics

3. POST /api/explain-denoising
   - Body: { audioId }
   - Call Python service with explainability module
   - Generate spectrogram comparisons
   - Return noise detection results and visualizations

4. POST /api/calculate-aqi
   - Body: { audioId }
   - Calculate 6 quality metrics
   - Return AQI score (0-100) and detailed metrics

5. POST /api/detect-tampering
   - Body: { audioId }
   - Run RawNet3 forensic analysis
   - Detect splices, edits, manipulations
   - Return authenticity score and detection results

6. GET /api/audio/:id
   - Return audio file metadata
   - Include processing history
   - Return download URLs

7. DELETE /api/audio/:id
   - Delete audio file and associated data
   - Clean up processed versions

MONGODB SCHEMA:

Audio Model:
{
  filename: String,
  originalPath: String,
  enhancedPath: String,
  format: String,
  duration: Number,
  sampleRate: Number,
  channels: Number,
  fileSize: Number,
  uploadDate: Date,
  
  metadata: {
    bitrate: Number,
    codec: String
  },
  
  processing: {
    enhanced: Boolean,
    enhancementModel: String,
    aqiScore: Number,
    authenticityScore: Number,
    tamperingDetected: Boolean
  },
  
  results: {
    enhancement: Object,
    explainability: Object,
    aqi: Object,
    forensics: Object
  }
}

ERROR HANDLING:
- Use try-catch for all async operations
- Return proper HTTP status codes
- Provide clear error messages
- Log errors to console/file

CORS CONFIGURATION:
- Allow requests from React frontend
- Enable credentials
- Allow methods: GET, POST, DELETE





############################
Python Microservices Prompt


Create Python Flask microservices for AI processing:

STRUCTURE:
/python-services
  /models
    - demucs_model.py
    - cleanunet_model.py
    - fullsubnet_model.py
    - rawnet3_model.py
  /services
    - enhancement_service.py
    - explainability_service.py
    - aqi_service.py
    - forensics_service.py
  - app.py (Flask server)
  - requirements.txt

FLASK ENDPOINTS:

1. POST /enhance
   - Accept: audio file, model name, settings
   - Process: Load model, enhance audio
   - Return: enhanced audio file + metrics

2. POST /explain
   - Accept: original audio, enhanced audio
   - Process: Generate spectrograms, GradCAM
   - Return: noise detections, visualizations

3. POST /aqi
   - Accept: audio file
   - Process: Calculate SNR, clarity, distortion, etc.
   - Return: AQI score + 6 metrics

4. POST /forensics
   - Accept: audio file
   - Process: RawNet3 analysis, ENF check
   - Return: authenticity score + detections

REQUIREMENTS.txt:
flask==2.3.0
torch==2.0.0
torchaudio==2.0.0
librosa==0.10.0
numpy==1.24.0
scipy==1.10.0
matplotlib==3.7.0
demucs
soundfile

DOCKER CONFIGURATION:
Create Dockerfile for Python services:
- Base image: python:3.9
- Install dependencies
- Copy model files
- Expose port 5000
- Run Flask app





#######################
Create Python Flask microservices for AI processing:

STRUCTURE:
/python-services
  /models
    - demucs_model.py
    - cleanunet_model.py
    - fullsubnet_model.py
    - rawnet3_model.py
  /services
    - enhancement_service.py
    - explainability_service.py
    - aqi_service.py
    - forensics_service.py
  - app.py (Flask server)
  - requirements.txt

FLASK ENDPOINTS:

1. POST /enhance
   - Accept: audio file, model name, settings
   - Process: Load model, enhance audio
   - Return: enhanced audio file + metrics

2. POST /explain
   - Accept: original audio, enhanced audio
   - Process: Generate spectrograms, GradCAM
   - Return: noise detections, visualizations

3. POST /aqi
   - Accept: audio file
   - Process: Calculate SNR, clarity, distortion, etc.
   - Return: AQI score + 6 metrics

4. POST /forensics
   - Accept: audio file
   - Process: RawNet3 analysis, ENF check
   - Return: authenticity score + detections

REQUIREMENTS.txt:
flask==2.3.0
torch==2.0.0
torchaudio==2.0.0
librosa==0.10.0
numpy==1.24.0
scipy==1.10.0
matplotlib==3.7.0
demucs
soundfile

DOCKER CONFIGURATION:
Create Dockerfile for Python services:
- Base image: python:3.9
- Install dependencies
- Copy model files
- Expose port 5000
- Run Flask app






#########################
Frontend Component Structure Prompt

Create React components with the following structure:

/src
  /components
    /Dashboard
      - AudioUpload.jsx
      - AudioInfo.jsx
      - WaveformPlayer.jsx
      - ModuleButtons.jsx
    /Modules
      - EnhancementModule.jsx
      - ExplainabilityModule.jsx
      - AQIModule.jsx
      - ForensicsModule.jsx
    /Common
      - Modal.jsx
      - Button.jsx
      - ProgressBar.jsx
      - Card.jsx
  /services
    - api.js (axios configuration)
  /utils
    - audioUtils.js
  /styles
    - tailwind.css
  - App.jsx
  - main.jsx

STYLING WITH TAILWIND:
- Use utility classes for all styling
- Create reusable component classes
- Responsive design with sm:, md:, lg: prefixes
- Use Tailwind colors: blue-500, gray-100, etc.
- Add hover: and focus: states

STATE MANAGEMENT:
- Use React Context for global audio state
- useState for component-local state
- useEffect for API calls
- Custom hooks for reusable logic






##############################
Complete Integration Prompt


FINAL INTEGRATION INSTRUCTIONS:

1. SETUP:
   - Initialize MERN project
   - Install dependencies (React, Express, MongoDB, Tailwind)
   - Configure Vite for React frontend
   - Setup Express server
   - Connect MongoDB Atlas or local MongoDB

2. FILE UPLOAD:
   - Use Multer middleware for file uploads
   - Store files in /uploads directory
   - Implement drag-and-drop with react-dropzone
   - Show upload progress

3. AUDIO PROCESSING:
   - Extract waveform data using WaveSurfer.js
   - Display waveform on main page
   - Implement play/pause/seek functionality
   - Add volume and speed controls

4. MODULE INTEGRATION:
   - Each module button opens modal
   - Pass audio ID to module
   - Fetch results from backend APIs
   - Display results in module interface
   - Allow download of processed audio

5. REAL-TIME UPDATES:
   - Use WebSocket or Server-Sent Events for progress
   - Show processing status
   - Update UI when processing completes

6. ERROR HANDLING:
   - Display user-friendly error messages
   - Handle file upload errors
   - Handle API timeout errors
   - Provide retry mechanisms

7. DEPLOYMENT:
   - Frontend: Deploy to Vercel
   - Backend: Deploy to Render
   - Python services: Deploy as Docker containers
   - MongoDB: Use MongoDB Atlas
   - Configure environment variables

8. TESTING:
   - Test all module functionalities
   - Test file upload with different formats
   - Test API endpoints
   - Test error scenarios
   - Ensure responsive design works