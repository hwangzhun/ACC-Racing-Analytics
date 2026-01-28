import React, { useState } from 'react';
import Header from './components/Header';
import Leaderboard from './components/Leaderboard';
import LapAnalysis from './components/LapAnalysis';
import ConsistencyChart from './components/ConsistencyChart';
import DriverDetail from './components/DriverDetail';
import { AccResultData } from './types';
import { Upload } from 'lucide-react';

const App: React.FC = () => {
    // Initialize with no data
    const [data, setData] = useState<AccResultData | null>(null);
    const [selectedCarId, setSelectedCarId] = useState<number | null>(null);

    // Initial select first driver if data exists
    React.useEffect(() => {
        if (data && data.sessionResult.leaderBoardLines.length > 0 && !selectedCarId) {
            setSelectedCarId(data.sessionResult.leaderBoardLines[0].car.carId);
        }
    }, [data, selectedCarId]);

    const handleFileUpload = (newData: AccResultData) => {
        setData(newData);
        if (newData.sessionResult.leaderBoardLines.length > 0) {
            setSelectedCarId(newData.sessionResult.leaderBoardLines[0].car.carId);
        }
    };

    const { sessionResult, laps, penalties = [] } = data || {
        sessionResult: { leaderBoardLines: [], bestlap: 0, bestSplits: [], isWetSession: 0, type: 0 },
        laps: [],
        penalties: []
    };

    return (
        <div className="min-h-screen flex flex-col bg-slate-900 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')]">
            <Header data={data} onFileUpload={handleFileUpload} />

            <main className="flex-grow p-4 md:p-6 max-w-7xl mx-auto w-full space-y-6">
                {!data ? (
                    /* Empty State - No Data */
                    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
                        <div className="bg-slate-800 border border-slate-700 rounded-xl p-12 max-w-md">
                            <div className="flex justify-center mb-6">
                                <div className="p-4 bg-slate-700 rounded-full">
                                    <Upload className="w-12 h-12 text-slate-400" />
                                </div>
                            </div>
                            <h2 className="text-2xl font-bold text-white mb-3">欢迎使用 ACC 遥测数据分析器</h2>
                            <p className="text-slate-400 mb-6">
                                请点击右上角的"加载 JSON"按钮，上传 ACC 导出的结果文件以开始分析。
                            </p>
                            <div className="text-sm text-slate-500 space-y-1">
                                <p>支持的文件格式：JSON</p>
                                <p>支持的文件类型：练习赛、排位赛、正赛结果</p>
                            </div>
                        </div>
                    </div>
                ) : (
                    /* Top Section: Leaderboard (Left) & Driver Details (Right) */
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                        {/* Leaderboard Column */}
                        <div className="lg:col-span-7 xl:col-span-8 flex flex-col gap-6">
                            <Leaderboard 
                                lines={sessionResult.leaderBoardLines} 
                                sessionType={data.sessionType}
                                onSelectDriver={setSelectedCarId}
                                selectedCarId={selectedCarId}
                                penalties={penalties}
                                trackName={data.trackName}
                                sessionName={data.serverName}
                            />
                            
                            {/* Charts Section */}
                            <div className="space-y-6">
                                <div className="h-[400px]">
                                    <LapAnalysis 
                                        laps={laps} 
                                        leaderboard={sessionResult.leaderBoardLines}
                                        selectedCarId={selectedCarId}
                                    />
                                </div>
                                <div className="h-[350px]">
                                    <ConsistencyChart
                                        laps={laps}
                                        leaderboard={sessionResult.leaderBoardLines}
                                        selectedCarId={selectedCarId}
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Driver Detail Column - Sticky on Desktop */}
                        <div className="lg:col-span-5 xl:col-span-4">
                            <div className="sticky top-24 h-[calc(100vh-8rem)]">
                                <DriverDetail 
                                    carId={selectedCarId} 
                                    leaderboard={sessionResult.leaderBoardLines}
                                    laps={laps}
                                    sessionBestSplits={sessionResult.bestSplits}
                                    penalties={penalties}
                                />
                            </div>
                        </div>
                    </div>
                )}
            </main>

            <footer className="bg-slate-950 text-slate-600 text-center p-4 text-xs border-t border-slate-900 mt-auto">
                ACC 遥测可视化工具 &copy; {new Date().getFullYear()}
            </footer>
        </div>
    );
};

export default App;