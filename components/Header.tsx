import React, { useRef } from 'react';
import { Upload, Trophy, Flag, Server } from 'lucide-react';
import { AccResultData } from '../types';
import { readAccResultJsonFile, alertAccResultFileError } from '../utils';

interface HeaderProps {
    data: AccResultData | null;
    onFileUpload: (data: AccResultData) => void;
}

const Header: React.FC<HeaderProps> = ({ data, onFileUpload }) => {
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        try {
            const json = await readAccResultJsonFile(file);
            onFileUpload(json);
        } catch (err) {
            alertAccResultFileError(err);
        }
        e.target.value = '';
    };

    return (
        <header className="bg-slate-900 border-b border-slate-800 p-6 sticky top-0 z-20 shadow-xl backdrop-blur-md bg-opacity-90">
            <div className="max-w-[1800px] mx-auto flex flex-col md:flex-row justify-between items-center gap-4">
                
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-gradient-to-br from-red-600 to-red-800 rounded-lg shadow-lg">
                        <Trophy className="w-8 h-8 text-white" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-black tracking-tighter text-white italic">ACC <span className="text-red-500">Racing Analytics</span></h1>
                        <p className="text-xs text-slate-400 font-mono tracking-wider">ACC 成绩分析器</p>
                    </div>
                </div>

                {data && (
                    <div className="flex flex-wrap gap-4 md:gap-8 text-sm">
                        <div className="flex items-center gap-2">
                            <Flag className="w-4 h-4 text-yellow-500" />
                            <div>
                                <p className="text-slate-500 text-xs uppercase font-bold">赛道</p>
                                <p className="text-white font-medium capitalize">{data.trackName}</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="px-2 py-0.5 rounded bg-slate-800 border border-slate-700 text-slate-300 font-mono text-xs">
                                {data.sessionType}
                            </div>
                            <div>
                                <p className="text-slate-500 text-xs uppercase font-bold">会话</p>
                                <p className="text-white font-medium">索引 {data.sessionIndex + 1}</p>
                            </div>
                        </div>
                        <div className="hidden lg:flex items-center gap-2">
                             <Server className="w-4 h-4 text-blue-500" />
                            <div>
                                <p className="text-slate-500 text-xs uppercase font-bold">服务器</p>
                                <p className="text-white font-medium truncate max-w-[150px]">{data.serverName}</p>
                            </div>
                        </div>
                    </div>
                )}

                <div className="flex items-center">
                    <button 
                        onClick={() => fileInputRef.current?.click()}
                        className="group flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition-all border border-slate-700 hover:border-slate-500"
                    >
                        <Upload className="w-4 h-4 group-hover:-translate-y-0.5 transition-transform" />
                        <span className="text-sm font-medium">加载 JSON</span>
                    </button>
                    <input 
                        type="file" 
                        ref={fileInputRef} 
                        onChange={handleFileChange} 
                        accept=".json,application/json" 
                        className="hidden" 
                    />
                </div>
            </div>
        </header>
    );
};

export default Header;
