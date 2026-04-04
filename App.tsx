import React, { useState, useRef, useEffect } from 'react';
import Header from './components/Header';
import Leaderboard from './components/Leaderboard';
import DriverDetail from './components/DriverDetail';
import { AccResultData, CarPerformanceClass, getCarClassByModelId } from './types';
import { Upload } from 'lucide-react';
import {
    readAccResultJsonFile,
    alertAccResultFileError,
    dragEventHasFiles,
    sortLeaderboardLinesForDisplay,
} from './utils';

export type LeaderboardClassFilter = 'all' | CarPerformanceClass;

const App: React.FC = () => {
    // Initialize with no data
    const [data, setData] = useState<AccResultData | null>(null);
    const [selectedCarId, setSelectedCarId] = useState<number | null>(null);
    const [manualPenaltyMsByCarId, setManualPenaltyMsByCarId] = useState<Record<number, number>>({});
    const [isFileDragOver, setIsFileDragOver] = useState(false);
    const [classFilter, setClassFilter] = useState<LeaderboardClassFilter>('all');
    const emptyFileInputRef = useRef<HTMLInputElement>(null);

    // Initial select first driver if data exists
    React.useEffect(() => {
        if (data && data.sessionResult.leaderBoardLines.length > 0 && !selectedCarId) {
            setSelectedCarId(data.sessionResult.leaderBoardLines[0].car.carId);
        }
    }, [data, selectedCarId]);

    const handleFileUpload = (newData: AccResultData) => {
        setData(newData);
        setManualPenaltyMsByCarId({});
        setClassFilter('all');
        if (newData.sessionResult.leaderBoardLines.length > 0) {
            setSelectedCarId(newData.sessionResult.leaderBoardLines[0].car.carId);
        }
    };

    useEffect(() => {
        if (!data || classFilter === 'all') return;
        const penaltiesMerged = [
            ...(data.penalties ?? []),
            ...(data.post_race_penalties ?? []),
        ];
        const sorted = sortLeaderboardLinesForDisplay(
            data.sessionResult.leaderBoardLines,
            data.sessionType,
            penaltiesMerged,
            manualPenaltyMsByCarId
        );
        const visible = sorted.filter(
            (l) => getCarClassByModelId(l.car.carModel) === classFilter
        );
        if (visible.length === 0) return;
        setSelectedCarId((prev) => {
            if (prev != null && visible.some((l) => l.car.carId === prev)) return prev;
            return visible[0].car.carId;
        });
    }, [classFilter, data, manualPenaltyMsByCarId]);

    const loadFromFile = async (file: File) => {
        try {
            const json = await readAccResultJsonFile(file);
            handleFileUpload(json);
        } catch (err) {
            alertAccResultFileError(err);
        }
    };

    useEffect(() => {
        const end = () => setIsFileDragOver(false);
        window.addEventListener('dragend', end);
        return () => window.removeEventListener('dragend', end);
    }, []);

    const handleMainDragEnter = (e: React.DragEvent<HTMLElement>) => {
        if (!dragEventHasFiles(e)) return;
        e.preventDefault();
        setIsFileDragOver(true);
    };

    const handleMainDragLeave = (e: React.DragEvent<HTMLElement>) => {
        const related = e.relatedTarget as Node | null;
        if (related && e.currentTarget.contains(related)) return;
        setIsFileDragOver(false);
    };

    const handleMainDragOver = (e: React.DragEvent<HTMLElement>) => {
        if (!dragEventHasFiles(e)) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = 'copy';
    };

    const handleMainDrop = async (e: React.DragEvent<HTMLElement>) => {
        e.preventDefault();
        setIsFileDragOver(false);
        const file = e.dataTransfer.files?.[0];
        if (!file) return;
        await loadFromFile(file);
    };

    const handleEmptyFileInputChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        await loadFromFile(file);
        e.target.value = '';
    };

    const setManualPenaltyForCar = (carId: number, ms: number) => {
        const clamped = Math.min(9999_000, Math.max(0, Math.round(ms)));
        setManualPenaltyMsByCarId((prev) => {
            if (clamped === 0) {
                const next = { ...prev };
                delete next[carId];
                return next;
            }
            return { ...prev, [carId]: clamped };
        });
    };

    const sessionResult = data?.sessionResult ?? {
        leaderBoardLines: [],
        bestlap: 0,
        bestSplits: [],
        isWetSession: 0,
        type: 0,
    };
    const laps = data?.laps ?? [];
    const penalties = data
        ? [...(data.penalties ?? []), ...(data.post_race_penalties ?? [])]
        : [];

    return (
        <div className="min-h-screen flex flex-col bg-slate-900 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')]">
            <Header data={data} onFileUpload={handleFileUpload} />

            <main
                className={`flex-grow p-4 md:p-6 max-w-[1800px] mx-auto w-full space-y-6 transition-shadow duration-200 rounded-xl ${
                    isFileDragOver ? 'ring-2 ring-red-500/60 ring-offset-4 ring-offset-slate-900' : ''
                }`}
                onDragEnter={handleMainDragEnter}
                onDragLeave={handleMainDragLeave}
                onDragOver={handleMainDragOver}
                onDrop={handleMainDrop}
            >
                {!data ? (
                    /* Empty State - No Data */
                    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-2">
                        <input
                            ref={emptyFileInputRef}
                            type="file"
                            accept=".json,application/json"
                            className="hidden"
                            onChange={handleEmptyFileInputChange}
                        />
                        <div
                            role="button"
                            tabIndex={0}
                            onClick={() => emptyFileInputRef.current?.click()}
                            onKeyDown={(ev) => {
                                if (ev.key === 'Enter' || ev.key === ' ') {
                                    ev.preventDefault();
                                    emptyFileInputRef.current?.click();
                                }
                            }}
                            className={`bg-slate-800 border rounded-xl p-12 max-w-md cursor-pointer select-none transition-colors outline-none focus-visible:ring-2 focus-visible:ring-red-500/60 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900 ${
                                isFileDragOver
                                    ? 'border-red-500/70 bg-slate-800/95 shadow-lg shadow-red-950/20'
                                    : 'border-slate-700 hover:border-slate-500'
                            }`}
                        >
                            <div className="flex justify-center mb-6">
                                <div className="p-4 bg-slate-700 rounded-full">
                                    <Upload className="w-12 h-12 text-slate-400" aria-hidden />
                                </div>
                            </div>
                            <h2 className="text-2xl font-bold text-white mb-3">欢迎使用 ACC 成绩分析器</h2>
                            <p className="text-slate-400 mb-4">
                                将 ACC 导出的结果 <span className="text-slate-300 font-mono">.json</span>{' '}
                                拖入本页任意区域释放即可加载；也可使用右上角「加载 JSON」。
                            </p>
                            <p className="text-red-400 hover:text-red-300 text-sm font-semibold mb-6 underline-offset-4 decoration-red-500/50">
                                点击此处选择文件
                            </p>
                            <div className="text-sm text-slate-500 space-y-1 border-t border-slate-700/80 pt-6">
                                <p>支持的文件格式：JSON</p>
                                <p>支持的文件类型：练习赛、排位赛、正赛结果</p>
                            </div>
                        </div>
                    </div>
                ) : (
                    /* Top Section: Leaderboard (Left) & Driver Details (Right) */
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                        {/* Leaderboard Column */}
                        <div className="lg:col-span-8 xl:col-span-9 min-w-0">
                            <Leaderboard 
                                lines={sessionResult.leaderBoardLines} 
                                sessionType={data.sessionType}
                                onSelectDriver={setSelectedCarId}
                                selectedCarId={selectedCarId}
                                penalties={penalties}
                                manualPenaltyMsByCarId={manualPenaltyMsByCarId}
                                trackName={data.trackName}
                                sessionName={data.serverName}
                                classFilter={classFilter}
                                onClassFilterChange={setClassFilter}
                            />
                        </div>

                        {/* Driver Detail Column - Sticky on Desktop */}
                        <div className="lg:col-span-4 xl:col-span-3 min-w-0">
                            <div className="sticky top-24 h-[calc(100vh-8rem)]">
                                <DriverDetail 
                                    carId={selectedCarId} 
                                    leaderboard={sessionResult.leaderBoardLines}
                                    laps={laps}
                                    sessionBestSplits={sessionResult.bestSplits}
                                    sessionType={data.sessionType}
                                    penalties={penalties}
                                    manualPenaltyMsByCarId={manualPenaltyMsByCarId}
                                    onManualPenaltyChange={setManualPenaltyForCar}
                                />
                            </div>
                        </div>
                    </div>
                )}
            </main>

            <footer className="bg-slate-950 text-slate-600 text-center p-4 text-xs border-t border-slate-900 mt-auto">
                ACC 成绩分析器 By Hwangzhun &copy; {new Date().getFullYear()}
            </footer>
        </div>
    );
};

export default App;