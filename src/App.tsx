import React, { useState, useEffect } from 'react';
import { UploadCloud, FileSpreadsheet, Key, Settings2, Download, AlertCircle, Play, Loader2 } from 'lucide-react';
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
    const savedKey = localStorage.getItem('xai_api_key');
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
      // 1. Get Template Headers
      const templateData = await parseFileToJSON(templateFile);
      if (templateData.length === 0) throw new Error("Template file is empty.");
      const templateHeaders = Object.keys(templateData[0]);

      setProgress(15);
      setProgressText('Parsing supplier data...');
      
      // 2. Parse Supplier File
      const supplierData = await parseFileToJSON(supplierFile);
      if (supplierData.length === 0) throw new Error("Supplier file is empty.");

      // Filter out completely empty rows
      const validSupplierData = supplierData.filter(row => Object.keys(row).length > 0);
      
      let finalData: any[] = [];
      
      // 3. Batching
      const BATCH_SIZE = 15;
      const totalBatches = Math.ceil(validSupplierData.length / BATCH_SIZE);
      
      for (let i = 0; i < totalBatches; i++) {
        setProgressText(`Converting batch ${i + 1} of ${totalBatches}...`);
        
        const batch = validSupplierData.slice(i * BATCH_SIZE, (i + 1) * BATCH_SIZE);
        
        // Retry logic for AI
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
            await new Promise(r => setTimeout(r, 2000)); // wait before retry
          }
        }
        
        const percentage = 15 + Math.round(((i + 1) / totalBatches) * 80);
        setProgress(percentage);
      }

      setProgressText('Compiling final CSV...');
      setProgress(98);

      // 4. Convert to CSV
      const csvOutput = Papa.unparse(finalData, { columns: templateHeaders });
      const blob = new Blob([csvOutput], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      
      setResultCsv(url);
      setProgress(100);
      setProgressText('Complete!');

    } catch (err: any) {
      console.error(err);
      setError(err.message || "An unexpected error occurred during processing.");
    } finally {
      setIsProcessing(false);
      setProgress(0);
    }
  };

  return (
    <div className="min-h-screen py-12 px-4 sm:px-6 lg:px-8 flex flex-col items-center">
      <div className="w-full max-w-4xl space-y-8">
        
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center p-3 bg-brand-500/10 rounded-2xl mb-4">
            <FileSpreadsheet className="w-10 h-10 text-brand-400" />
          </div>
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-white mb-2">
            Universal Converter
          </h1>
          <p className="text-slate-400 text-lg max-w-2xl mx-auto mt-2">
            Intelligently transform any supplier price list into your target Shopify template using AI. 
            All processing happens securely in your browser.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-4">
          
          {/* Settings Sidebar */}
          <div className="md:col-span-1 space-y-6">
            <div className="glass-panel p-6 shadow-2xl bg-slate-800/80">
              <h2 className="text-lg font-semibold flex items-center gap-2 mb-4 text-white">
                <Settings2 className="w-5 h-5 text-brand-400" /> Configuration
              </h2>
              <div>
                <label className="text-sm font-medium text-slate-300 flex items-center gap-2">
                  <Key className="w-4 h-4" /> API Key (xAI / OpenAI)
                </label>
                <input 
                  type="password" 
                  className="glass-input mt-2" 
                  placeholder="xoxb-..." 
                  value={apiKey}
                  onChange={handleKeySave}
                />
                <p className="text-xs text-slate-500 mt-3 leading-relaxed">
                  Stored locally for privacy. Processing happens directly between your browser and the AI API.
                </p>
              </div>
            </div>
            
            {/* Status Panel if Result exists */}
            {resultCsv && !isProcessing && (
              <div className="glass-panel p-6 border-green-500/30 bg-green-500/10 shadow-[0_0_15px_rgba(34,197,94,0.1)]">
                <h3 className="text-green-400 font-semibold mb-3 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                  Conversion Complete!
                </h3>
                <a 
                  href={resultCsv} 
                  download="converted_shopify.csv"
                  className="btn-primary w-full shadow-green-500/20 bg-green-600 hover:bg-green-500"
                >
                  <Download className="w-5 h-5" /> Download CSV
                </a>
              </div>
            )}
          </div>
          
          {/* Main Upload Area */}
          <div className="md:col-span-2 space-y-6">
            <div className="glass-panel p-6 md:p-8 space-y-6 shadow-2xl bg-slate-800/80">
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                {/* Template Upload */}
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">1. Target Template (.csv)</label>
                  <label className="drop-zone relative h-44 bg-slate-900/50">
                    <input type="file" accept=".csv" className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" onChange={(e) => handleFileDrop(e, 'template')} />
                    <UploadCloud className={`w-10 h-10 mb-4 transition-colors ${templateFile ? 'text-brand-400' : 'text-slate-500'}`} />
                    <span className="text-sm text-slate-200 font-medium text-center px-4 truncate w-full">
                      {templateFile ? templateFile.name : "Upload Template File"}
                    </span>
                    <span className="text-xs text-slate-500 mt-2">Provides the target schema</span>
                  </label>
                </div>
                
                {/* Supplier Upload */}
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">2. Supplier Data (.xlsx/.csv)</label>
                  <label className="drop-zone relative h-44 bg-slate-900/50">
                    <input type="file" accept=".csv, .xlsx, .xls" className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" onChange={(e) => handleFileDrop(e, 'supplier')} />
                    <FileSpreadsheet className={`w-10 h-10 mb-4 transition-colors ${supplierFile ? 'text-brand-400' : 'text-slate-500'}`} />
                    <span className="text-sm text-slate-200 font-medium text-center px-4 truncate w-full">
                      {supplierFile ? supplierFile.name : "Upload Supplier File"}
                    </span>
                    <span className="text-xs text-slate-500 mt-2">Raw data to convert</span>
                  </label>
                </div>
              </div>

              {error && (
                <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl flex items-start gap-3 text-red-400 text-sm shadow-inner">
                  <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                  <p className="leading-relaxed">{error}</p>
                </div>
              )}

              {/* Action Button */}
              <div className="pt-4">
                <button 
                  onClick={startProcessing} 
                  disabled={isProcessing || !templateFile || !supplierFile}
                  className="btn-primary w-full py-4 text-lg font-semibold rounded-xl"
                >
                  {isProcessing ? (
                    <>
                      <Loader2 className="w-6 h-6 animate-spin" /> Processing AI... 
                    </>
                  ) : (
                    <>
                      <Play className="w-6 h-6 fill-current" /> Auto-Convert Data
                    </>
                  )}
                </button>
              </div>

              {/* Progress Bar */}
              {isProcessing && (
                <div className="space-y-3 mt-6 bg-slate-900/40 p-4 rounded-xl border border-slate-700/50">
                  <div className="flex justify-between text-sm text-slate-300 font-medium tracking-wide">
                    <span className="flex items-center gap-2">
                       <span className="w-2 h-2 rounded-full bg-brand-500 animate-ping"></span>
                       {progressText}
                    </span>
                    <span className="text-brand-400">{progress}%</span>
                  </div>
                  <div className="h-2 w-full bg-slate-800 rounded-full overflow-hidden shadow-inner">
                    <div 
                      className="h-full bg-brand-500 transition-all duration-300 ease-out relative"
                      style={{ width: `${progress}%` }}
                    >
                      <div className="absolute inset-0 bg-white/20 w-full h-full animate-[shimmer_2s_infinite]"></div>
                    </div>
                  </div>
                </div>
              )}
              
            </div>
          </div>
          
        </div>
      </div>
    </div>
  );
}
