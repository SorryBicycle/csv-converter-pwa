import React, { useState, useEffect } from 'react';
import { 
  UploadCloud, 
  FileSpreadsheet, 
  Key, 
  Settings2, 
  Download, 
  AlertCircle, 
  Loader2, 
  Sparkles,
  ChevronRight,
  ShieldCheck,
  Zap,
  CheckCircle2
} from 'lucide-react';
import Papa from 'papaparse';
import { parseFileToJSON } from './utils/fileParser';
import { processBatchWithAI } from './services/ai';

export default function App() {
  const [apiKey, setApiKey] = useState('');
  const [templateFile, setTemplateFile] = useState<File | null>(null);
  const [supplierFile, setSupplierFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressText, setProgressText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [resultCsv, setResultCsv] = useState<string | null>(null);

  useEffect(() => {
    const savedKey = localStorage.getItem('xai_api_key') || import.meta.env.VITE_GROQ_API_KEY;
    if (savedKey) setApiKey(savedKey);
  }, []);

  const handleKeySave = (e: React.ChangeEvent<HTMLInputElement>) => {
    setApiKey(e.target.value);
    localStorage.setItem('xai_api_key', e.target.value);
  };

  const handleFileDrop = (e: React.ChangeEvent<HTMLInputElement>, type: 'template' | 'supplier') => {
    const file = e.target.files?.[0];
    if (file) {
      if (type === 'template') setTemplateFile(file);
      if (type === 'supplier') setSupplierFile(file);
      setError(null);
    }
  };

  const startProcessing = async () => {
    if (!apiKey) return setError("Please input your API Key first.");
    if (!templateFile || !supplierFile) return setError("Please upload both files.");
    
    setIsProcessing(true);
    setProgress(5);
    setProgressText('Extracting template schema...');
    setError(null);
    setResultCsv(null);

    try {
      const templateData = await parseFileToJSON(templateFile);
      if (templateData.length === 0) throw new Error("Template file is empty.");
      const templateHeaders = Object.keys(templateData[0]);

      setProgress(15);
      setProgressText('Parsing supplier data...');
      
      const supplierData = await parseFileToJSON(supplierFile);
      if (supplierData.length === 0) throw new Error("Supplier file is empty.");

      const validSupplierData = supplierData.filter(row => Object.keys(row).length > 0);
      let finalData: any[] = [];
      const BATCH_SIZE = 15;
      const totalBatches = Math.ceil(validSupplierData.length / BATCH_SIZE);
      
      for (let i = 0; i < totalBatches; i++) {
        setProgressText(`Processing batch ${i + 1} of ${totalBatches}...`);
        const batch = validSupplierData.slice(i * BATCH_SIZE, (i + 1) * BATCH_SIZE);
        
        let retries = 2;
        let success = false;
        while (retries > 0 && !success) {
          try {
            const processedBatch = await processBatchWithAI(apiKey, templateHeaders, batch);
            finalData = [...finalData, ...processedBatch];
            success = true;
          } catch (err: any) {
            retries--;
            if (retries === 0) throw new Error(`AI processing failed: ${err.message}`);
            await new Promise(r => setTimeout(r, 2000));
          }
        }
        
        const percentage = 15 + Math.round(((i + 1) / totalBatches) * 80);
        setProgress(percentage);
      }

      setProgressText('Finalizing result...');
      setProgress(98);

      const csvOutput = Papa.unparse(finalData, { columns: templateHeaders });
      const blob = new Blob([csvOutput], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      
      setResultCsv(url);
      setProgress(100);
      setProgressText('Processing Complete');

    } catch (err: any) {
      console.error(err);
      setError(err.message || "An unexpected error occurred.");
    } finally {
      setIsProcessing(false);
      setProgress(0);
    }
  };

  return (
    <div className="min-h-screen py-12 px-6 flex flex-col items-center justify-center relative sm:py-20">
      
      {/* Dynamic Header */}
      <div className="w-full max-w-5xl mb-16 text-center">
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-white/5 bg-white/[0.03] text-zinc-400 text-xs font-bold uppercase tracking-widest mb-8">
          <Zap className="w-3 h-3 text-accent" /> Powered by Groq AI
        </div>
        <h1 className="text-6xl md:text-8xl font-black tracking-tighter text-white mb-6">
          Universal <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-indigo-500">Converter</span>
        </h1>
        <p className="text-zinc-400 text-xl md:text-2xl max-w-3xl mx-auto font-medium leading-relaxed">
          The world's fastest way to map supplier spreadsheets to Shopify.
          Upload your files and let Groq do the rest.
        </p>
      </div>

      <div className="w-full max-w-6xl grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        
        {/* Sidebar Controls */}
        <div className="lg:col-span-4 space-y-6">
          <div className="premium-card p-8">
            <h2 className="text-xl font-bold flex items-center gap-3 text-white mb-8 border-b border-white/5 pb-6">
              <Settings2 className="w-5 h-5 text-accent" /> Settings
            </h2>
            
            <div className="space-y-6">
              <div>
                <label className="text-sm font-bold text-zinc-400 uppercase tracking-widest mb-3 block">Groq API Key</label>
                <div className="relative group">
                  <input 
                    type="password" 
                    className="premium-input pr-12" 
                    placeholder="gsk_..." 
                    value={apiKey}
                    onChange={handleKeySave}
                  />
                  <Key className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-600 group-focus-within:text-accent transition-colors" />
                </div>
                <div className="mt-4 flex items-center gap-2 text-[10px] text-zinc-500 font-bold uppercase tracking-wider">
                  <ShieldCheck className="w-3 h-3" /> Encrypted Local Storage
                </div>
              </div>
            </div>
          </div>

          {resultCsv && !isProcessing && (
            <div className="p-1 rounded-[2.5rem] bg-gradient-to-br from-blue-500 to-indigo-600 shadow-[0_20px_50px_rgba(59,130,246,0.3)] transform transition-all duration-500 hover:scale-[1.02]">
              <div className="bg-slate-900 rounded-[2.3rem] p-8 flex flex-col gap-6">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-blue-500/10 flex items-center justify-center">
                    <CheckCircle2 className="w-6 h-6 text-blue-400" />
                  </div>
                  <div>
                    <h3 className="text-white font-bold text-lg">Batch Ready</h3>
                    <p className="text-zinc-400 text-sm">Download your conversion</p>
                  </div>
                </div>
                <a 
                  href={resultCsv} 
                  download="converted_data.csv"
                  className="w-full btn-action"
                >
                  <Download className="w-5 h-5" /> Download Result
                </a>
              </div>
            </div>
          )}
        </div>

        {/* Main Interface */}
        <div className="lg:col-span-8">
          <div className="premium-card p-4 sm:p-10">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-10">
              {/* Template */}
              <div className="group space-y-4">
                <div className="flex items-center justify-between px-2">
                  <span className="text-sm font-bold text-zinc-400 uppercase tracking-widest">1. Target Schema</span>
                  {templateFile && <CheckCircle2 className="w-4 h-4 text-emerald-500" />}
                </div>
                <label className="drop-zone-v2 min-h-64 group">
                  <input type="file" accept=".csv" className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" onChange={(e) => handleFileDrop(e, 'template')} />
                  <div className="w-16 h-16 rounded-3xl bg-white/[0.03] flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-500">
                    <UploadCloud className={`w-8 h-8 ${templateFile ? 'text-accent' : 'text-zinc-500'}`} />
                  </div>
                  <span className="text-lg text-white font-bold truncate max-w-full px-6">
                    {templateFile ? templateFile.name : "Target Template"}
                  </span>
                  <p className="text-zinc-500 text-sm mt-2 font-medium">Standard Shop CSV</p>
                </label>
              </div>

              {/* Data */}
              <div className="group space-y-4">
                <div className="flex items-center justify-between px-2">
                  <span className="text-sm font-bold text-zinc-400 uppercase tracking-widest">2. Supplier File</span>
                  {supplierFile && <CheckCircle2 className="w-4 h-4 text-emerald-500" />}
                </div>
                <label className="drop-zone-v2 min-h-64 group">
                  <input type="file" accept=".csv, .xlsx, .xls" className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" onChange={(e) => handleFileDrop(e, 'supplier')} />
                  <div className="w-16 h-16 rounded-3xl bg-white/[0.03] flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-500">
                    <FileSpreadsheet className={`w-8 h-8 ${supplierFile ? 'text-accent' : 'text-zinc-500'}`} />
                  </div>
                  <span className="text-lg text-white font-bold truncate max-w-full px-6">
                    {supplierFile ? supplierFile.name : "Raw Data Source"}
                  </span>
                  <p className="text-zinc-500 text-sm mt-2 font-medium">XLSX or CSV</p>
                </label>
              </div>
            </div>

            {error && (
              <div className="mb-8 p-6 bg-red-500/10 border border-red-500/20 rounded-3xl flex items-center gap-4 text-red-400 font-bold scale-in">
                <AlertCircle className="w-6 h-6 shrink-0" />
                {error}
              </div>
            )}

            {isProcessing ? (
              <div className="space-y-6 animate-pulse">
                <div className="flex items-center justify-between text-white font-black text-xs uppercase tracking-[0.2em]">
                  <span className="flex items-center gap-3">
                    <Loader2 className="w-4 h-4 animate-spin text-accent" /> {progressText}
                  </span>
                  <span className="text-accent">{progress}%</span>
                </div>
                <div className="h-4 w-full bg-white/5 rounded-full overflow-hidden relative border border-white/5">
                  <div 
                    className="h-full bg-gradient-to-r from-blue-500 via-indigo-400 to-blue-500 transition-all duration-500 relative"
                    style={{ width: `${progress}%` }}
                  >
                    <div className="absolute inset-0 animate-shimmer bg-gradient-to-r from-transparent via-white/20 to-transparent w-full"></div>
                  </div>
                </div>
              </div>
            ) : (
              <button 
                onClick={startProcessing} 
                disabled={!templateFile || !supplierFile}
                className="w-full btn-action h-20 text-xl"
              >
                <Sparkles className="w-6 h-6" /> Start Intelligent Conversion
                <ChevronRight className="w-5 h-5 ml-auto opacity-30" />
              </button>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
