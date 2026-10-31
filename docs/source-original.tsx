import React, { useState, useEffect, useMemo } from 'react';
import { 
  Users, Award, FileText, Trophy, ShieldCheck, 
  LogIn, LogOut, Plus, Trash2, Upload, Printer, 
  Sparkles, BarChart3, Edit3, CheckCircle, Mic, MessageSquare 
} from 'lucide-react';

// --- FIREBASE IMPORTS ---
import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  signInAnonymously, 
  signInWithCustomToken, 
  onAuthStateChanged 
} from 'firebase/auth';
import { 
  getFirestore, 
  collection, 
  doc, 
  setDoc, 
  deleteDoc, 
  onSnapshot 
} from 'firebase/firestore';

// --- INITIAL FIREBASE SETUP ---
const firebaseConfig = JSON.parse(__firebase_config);
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = typeof __app_id !== 'undefined' ? __app_id : 'duta-teknokrat-2026';

// DAFTAR PROGRAM STUDI RESMI TEKNOKRAT
const PRODI_LIST = [
  'S1 Informatika',
  'S1 Sistem Informasi',
  'S1 Teknologi Informasi',
  'S1 Manajemen',
  'S1 Akuntansi',
  'S1 Sastra Inggris',
  'S1 Pendidikan Bahasa Inggris',
  'S1 Pendidikan Olahraga'
];

export default function App() {
  // Auth State
  const [user, setUser] = useState(null);
  const [currentUserRole, setCurrentUserRole] = useState(null); // 'admin' or { role: 'juri', juriId, name, detail }

  // Database State (SEMUA DATA AWAL KOSONG)
  const [juris, setJuris] = useState([]);
  const [finalis, setFinalis] = useState([]);
  const [scores11, setScores11] = useState({});
  const [scores6, setScores6] = useState({});

  // UI States
  const [activeTab, setActiveTab] = useState('dashboard');
  const [adminPassInput, setAdminPassInput] = useState('');
  const [selectedJuriId, setSelectedJuriId] = useState('');
  const [importText, setImportText] = useState('');
  const [showImportModal, setShowImportModal] = useState(false);
  const [printType, setPrintType] = useState(null);
  const [toastMessage, setToastMessage] = useState(null);

  // New forms
  const [newJuri, setNewJuri] = useState({ name: '', role: '' });
  const [newFinalis, setNewFinalis] = useState({ name: '', prodi: PRODI_LIST[0], gender: 'Putra' });

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 2500);
  };

  // 1. AUTHENTICATION INIT
  useEffect(() => {
    const initAuth = async () => {
      try {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          await signInWithCustomToken(auth, __initial_auth_token);
        } else {
          await signInAnonymously(auth);
        }
      } catch (err) {
        console.error("Firebase auth error:", err);
      }
    };
    initAuth();
    const unsubscribe = onAuthStateChanged(auth, setUser);
    return () => unsubscribe();
  }, []);

  // 2. FIRESTORE REALTIME LISTENERS
  useEffect(() => {
    if (!user) return;

    // A. Listen Juris Collection
    const jurisRef = collection(db, 'artifacts', appId, 'public', 'data', 'juris');
    const unsubJuris = onSnapshot(jurisRef, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setJuris(data);
    }, (error) => console.error("Juris snapshot error:", error));

    // B. Listen Finalis Collection
    const finalisRef = collection(db, 'artifacts', appId, 'public', 'data', 'finalis');
    const unsubFinalis = onSnapshot(finalisRef, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setFinalis(data.sort((a, b) => parseInt(a.no || 0) - parseInt(b.no || 0)));
    }, (error) => console.error("Finalis snapshot error:", error));

    // C. Listen Scores 11 Besar (Speech)
    const scores11Ref = collection(db, 'artifacts', appId, 'public', 'data', 'scores11');
    const unsubScores11 = onSnapshot(scores11Ref, (snapshot) => {
      const map11 = {};
      snapshot.docs.forEach(docSnap => {
        const [juriId, finalisId] = docSnap.id.split('_');
        if (juriId && finalisId) {
          if (!map11[juriId]) map11[juriId] = {};
          map11[juriId][finalisId] = docSnap.data();
        }
      });
      setScores11(map11);
    }, (error) => console.error("Scores11 snapshot error:", error));

    // D. Listen Scores 6 Besar (QnA)
    const scores6Ref = collection(db, 'artifacts', appId, 'public', 'data', 'scores6');
    const unsubScores6 = onSnapshot(scores6Ref, (snapshot) => {
      const map6 = {};
      snapshot.docs.forEach(docSnap => {
        const [juriId, finalisId] = docSnap.id.split('_');
        if (juriId && finalisId) {
          if (!map6[juriId]) map6[juriId] = {};
          map6[juriId][finalisId] = docSnap.data();
        }
      });
      setScores6(map6);
    }, (error) => console.error("Scores6 snapshot error:", error));

    return () => {
      unsubJuris();
      unsubFinalis();
      unsubScores11();
      unsubScores6();
    };
  }, [user]);

  // --- REKAPITULASI LOGIC (BABAK 11 BESAR: SPEECH) ---
  const rekap11List = useMemo(() => {
    return finalis.map(f => {
      let totalSum = 0;
      let countJuriScored = 0;
      const breakdown = {};

      juris.forEach(j => {
        const val = scores11[j.id]?.[f.id];
        if (val) {
          const s1 = parseFloat(val.materiSpeech) || 0;
          const s2 = parseFloat(val.delivery) || 0;
          const s3 = parseFloat(val.publicSpeaking) || 0;
          const totalJuriScore = Number(((s1 + s2 + s3) / 3).toFixed(2));
          
          breakdown[j.id] = totalJuriScore;
          totalSum += totalJuriScore;
          countJuriScored++;
        } else {
          breakdown[j.id] = 0;
        }
      });

      const avgScore = countJuriScored > 0 ? (totalSum / countJuriScored) : 0;

      return {
        ...f,
        breakdown,
        totalSum,
        avgScore: Number(avgScore.toFixed(2))
      };
    });
  }, [finalis, juris, scores11]);

  // REKAP 11 BESAR TERURUT (DARI TERTINGGI TO TERENDAH - DIPISAH PUTRA & PUTRI)
  const sortedRekap11 = useMemo(() => {
    const putra = [...rekap11List].filter(f => f.gender === 'Putra').sort((a, b) => b.avgScore - a.avgScore);
    const putri = [...rekap11List].filter(f => f.gender === 'Putri').sort((a, b) => b.avgScore - a.avgScore);
    return { putra, putri };
  }, [rekap11List]);

  // --- KUALIFIKASI TOP 6 (3 PUTRA + 3 PUTRI TERTINGGI HASIL SPEECH) ---
  const top6Finalis = useMemo(() => {
    const top3Putra = sortedRekap11.putra.slice(0, 3);
    const top3Putri = sortedRekap11.putri.slice(0, 3);

    return {
      putra: top3Putra,
      putri: top3Putri,
      combined: [...top3Putra, ...top3Putri]
    };
  }, [sortedRekap11]);

  // --- REKAPITULASI LOGIC (BABAK 6 BESAR: Q&A) ---
  const rekap6List = useMemo(() => {
    return top6Finalis.combined.map(f => {
      let totalSum = 0;
      let countJuriScored = 0;
      const breakdown = {};

      juris.forEach(j => {
        const val = scores6[j.id]?.[f.id];
        if (val) {
          const s1 = parseFloat(val.kualitasJawaban) || 0;
          const s2 = parseFloat(val.kecepatanBerpikir) || 0;
          const s3 = parseFloat(val.bodyLanguage) || 0;
          const totalJuriScore = Number(((s1 + s2 + s3) / 3).toFixed(2));

          breakdown[j.id] = totalJuriScore;
          totalSum += totalJuriScore;
          countJuriScored++;
        } else {
          breakdown[j.id] = 0;
        }
      });

      const avgScore6 = countJuriScored > 0 ? (totalSum / countJuriScored) : 0;
      // Akumulasi: 40% Speech + 60% QnA
      const finalAccumulated = (f.avgScore * 0.4) + (avgScore6 * 0.6);

      return {
        ...f,
        breakdown6: breakdown,
        score6Total: totalSum,
        avgScore6: Number(avgScore6.toFixed(2)),
        finalAccumulated: Number(finalAccumulated.toFixed(2))
      };
    });
  }, [top6Finalis, juris, scores6]);

  // REKAP 6 BESAR TERURUT (DIPISAH PUTRA & PUTRI)
  const sortedRekap6 = useMemo(() => {
    const putra = [...rekap6List].filter(f => f.gender === 'Putra').sort((a, b) => b.finalAccumulated - a.finalAccumulated);
    const putri = [...rekap6List].filter(f => f.gender === 'Putri').sort((a, b) => b.finalAccumulated - a.finalAccumulated);
    return { putra, putri };
  }, [rekap6List]);

  // --- WINNERS RANKING (URUTAN 1 S.D. 6 DENGAN GELAR RESMI - TERPISAH PUTRA & PUTRI) ---
  const winnersRanked = useMemo(() => {
    const rankTitles = [
      'WINNER DUTA TEKNOKRAT 2026',
      '1st Runner Up (Peringkat 2)',
      '2nd Runner Up (Peringkat 3)',
      '3rd Runner Up (Peringkat 4)',
      '4th Runner Up (Peringkat 5)',
      '5th Runner Up (Peringkat 6)'
    ];

    const putraRanked = sortedRekap6.putra.map((f, idx) => ({ ...f, title: rankTitles[idx] || `${idx + 1}th Runner Up` }));
    const putriRanked = sortedRekap6.putri.map((f, idx) => ({ ...f, title: rankTitles[idx] || `${idx + 1}th Runner Up` }));

    return { 
      putra: putraRanked, 
      putri: putriRanked 
    };
  }, [sortedRekap6]);

  // --- HANDLERS ---
  const handleSelectAdmin = (e) => {
    e.preventDefault();
    if (adminPassInput === 'admin' || adminPassInput === '123' || adminPassInput === '') {
      setCurrentUserRole({ role: 'admin', name: 'Panitia Administrator' });
      setActiveTab('dashboard');
      showToast('Berhasil masuk sebagai Admin Panitia!');
    } else {
      alert('Password Admin salah! (Default: admin)');
    }
  };

  const handleSelectJuriRole = () => {
    if (!selectedJuriId) return;
    const juriObj = juris.find(j => j.id === selectedJuriId);
    if (juriObj) {
      setCurrentUserRole({ role: 'juri', juriId: juriObj.id, name: juriObj.name, detail: juriObj.role });
      setActiveTab('penilaian11');
      showToast(`Selamat Datang, ${juriObj.name}!`);
    }
  };

  const handleAddJuri = async (e) => {
    e.preventDefault();
    if (!newJuri.name || !user) return;
    const id = 'j_' + Date.now();
    await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'juris', id), {
      name: newJuri.name,
      role: newJuri.role || 'Dewan Juri'
    });
    setNewJuri({ name: '', role: '' });
    showToast('Juri berhasil ditambahkan!');
  };

  const handleDeleteJuri = async (id) => {
    if (confirm('Hapus Dewan Juri ini?')) {
      await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'juris', id));
      showToast('Juri dihapus.');
    }
  };

  const handleAddFinalis = async (e) => {
    e.preventDefault();
    if (!newFinalis.name || !user) return;
    
    // Auto-generate nomor urut berdasarkan total finalis + 1
    const nextNo = (finalis.length + 1).toString().padStart(2, '0');
    const id = 'f_' + Date.now();
    
    await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'finalis', id), {
      no: nextNo,
      name: newFinalis.name,
      prodi: newFinalis.prodi,
      gender: newFinalis.gender
    });
    
    setNewFinalis({ name: '', prodi: PRODI_LIST[0], gender: 'Putra' });
    showToast(`Finalis #${nextNo} berhasil ditambahkan!`);
  };

  const handleDeleteFinalis = async (id) => {
    await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'finalis', id));
    showToast('Finalis dihapus.');
  };

  const handleImportExcelParser = async () => {
    if (!importText.trim() || !user) return;
    const lines = importText.trim().split('\n');
    let count = 0;
    let currentTotal = finalis.length;

    for (let index = 0; index < lines.length; index++) {
      const line = lines[index];
      const cols = line.split('\t').length > 1 ? line.split('\t') : line.split(',');
      if (cols.length >= 1 && cols[0].trim() !== '') {
        currentTotal++;
        const autoNo = currentTotal.toString().padStart(2, '0');
        const id = 'f_imp_' + Date.now() + '_' + index;
        
        const rawName = cols[0]?.trim() || 'Tanpa Nama';
        const rawProdi = cols[1]?.trim() || PRODI_LIST[0];
        const rawGender = cols[2]?.trim().toLowerCase().includes('putri') ? 'Putri' : 'Putra';

        await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'finalis', id), {
          no: autoNo,
          name: rawName,
          prodi: rawProdi,
          gender: rawGender
        });
        count++;
      }
    }

    if (count > 0) {
      setImportText('');
      setShowImportModal(false);
      showToast(`Sukses mendata ${count} finalis!`);
    }
  };

  const finalisPutra = useMemo(() => finalis.filter(f => f.gender === 'Putra'), [finalis]);
  const finalisPutri = useMemo(() => finalis.filter(f => f.gender === 'Putri'), [finalis]);

  // LOGIN SCREEN
  if (!currentUserRole) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-600 via-rose-500 to-amber-500 flex items-center justify-center p-4 font-sans text-slate-800">
        <div className="w-full max-w-2xl bg-white/95 rounded-3xl p-6 sm:p-10 shadow-2xl border border-white/60 backdrop-blur-xl">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-gradient-to-tr from-red-600 to-amber-400 p-1 mb-3 shadow-xl">
              <div className="w-full h-full bg-white rounded-full flex items-center justify-center">
                <Trophy className="w-10 h-10 text-red-600" />
              </div>
            </div>
            <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
              DUTA TEKNOKRAT <span className="text-red-600">2026</span>
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 font-semibold uppercase tracking-wider mt-1">
              Universitas Teknokrat Indonesia • Sistem Penilaian Real-Time
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* JURI LOGIN PANEL */}
            <div className="bg-gradient-to-br from-red-50 to-orange-50 border border-red-200 hover:border-red-400 transition-all rounded-2xl p-6 flex flex-col justify-between shadow-sm">
              <div>
                <div className="w-10 h-10 bg-red-600 text-white rounded-xl flex items-center justify-center mb-3 shadow-md">
                  <Edit3 className="w-5 h-5" />
                </div>
                <h2 className="text-base font-bold text-slate-900 mb-1">DEWAN JURI</h2>
                <p className="text-xs text-slate-600 mb-4">Pilih Akun Dewan Juri yang Terdaftar:</p>
                
                {juris.length === 0 ? (
                  <div className="bg-amber-100/70 border border-amber-300 text-amber-800 p-3 rounded-xl text-xs font-semibold mb-4">
                    Belum ada Juri. Minta Admin untuk mendaftarkan akun Juri terlebih dahulu.
                  </div>
                ) : (
                  <select 
                    value={selectedJuriId}
                    onChange={(e) => setSelectedJuriId(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-xl p-3 text-xs text-slate-800 focus:ring-2 focus:ring-red-500 focus:outline-none mb-4 shadow-inner font-semibold"
                  >
                    <option value="">-- Pilih Nama Juri --</option>
                    {juris.map(j => (
                      <option key={j.id} value={j.id}>{j.name} ({j.role})</option>
                    ))}
                  </select>
                )}
              </div>

              <button 
                onClick={handleSelectJuriRole}
                disabled={!selectedJuriId || juris.length === 0}
                className="w-full bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white font-bold py-3 rounded-xl text-xs transition-all shadow-md flex items-center justify-center gap-2"
              >
                <LogIn className="w-4 h-4" />
                <span>Masuk Portal Juri</span>
              </button>
            </div>

            {/* ADMIN LOGIN PANEL */}
            <div className="bg-gradient-to-br from-teal-50 to-sky-50 border border-teal-200 hover:border-teal-400 transition-all rounded-2xl p-6 flex flex-col justify-between shadow-sm">
              <div>
                <div className="w-10 h-10 bg-teal-600 text-white rounded-xl flex items-center justify-center mb-3 shadow-md">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <h2 className="text-base font-bold text-slate-900 mb-1">PANITIA ADMIN</h2>
                <p className="text-xs text-slate-600 mb-4">Kelola Juri, Finalis, & Berita Acara:</p>
                
                <form onSubmit={handleSelectAdmin}>
                  <input 
                    type="password"
                    placeholder="Password (Default: admin)"
                    value={adminPassInput}
                    onChange={(e) => setAdminPassInput(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-xl p-3 text-xs text-slate-800 focus:ring-2 focus:ring-teal-500 focus:outline-none mb-4 font-semibold shadow-inner"
                  />
                  <button 
                    type="submit"
                    className="w-full bg-teal-600 hover:bg-teal-700 text-white font-bold py-3 rounded-xl text-xs transition-all shadow-md flex items-center justify-center gap-2"
                  >
                    <ShieldCheck className="w-4 h-4" />
                    <span>Masuk Portal Admin</span>
                  </button>
                </form>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans flex flex-col">
      
      {/* TOAST NOTIFICATION */}
      {toastMessage && (
        <div className="fixed bottom-5 right-5 z-50 bg-slate-900 text-white px-4 py-2.5 rounded-xl shadow-2xl text-xs font-semibold flex items-center gap-2 animate-bounce">
          <CheckCircle className="w-4 h-4 text-teal-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* HEADER NAVBAR */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-40 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-red-600 to-amber-400 p-0.5 flex items-center justify-center shadow-sm">
              <div className="w-full h-full bg-white rounded-[10px] flex items-center justify-center">
                <Trophy className="w-5 h-5 text-red-600" />
              </div>
            </div>
            <div>
              <h1 className="font-extrabold text-slate-900 text-base leading-tight">
                DUTA TEKNOKRAT <span className="text-red-600">2026</span>
              </h1>
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-slate-500 font-medium">Universitas Teknokrat Indonesia</span>
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-bold bg-teal-100 text-teal-700 border border-teal-200">
                  ● Live Cloud Sync
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <div className="text-right">
              <span className="text-xs font-bold text-slate-800 block">{currentUserRole.name}</span>
              <span className="text-[10px] bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-bold uppercase inline-block">
                {currentUserRole.role === 'admin' ? 'PANITIA ADMIN' : currentUserRole.detail}
              </span>
            </div>
            <button 
              onClick={() => setCurrentUserRole(null)}
              className="bg-slate-100 hover:bg-red-50 text-slate-600 hover:text-red-600 p-2 rounded-xl text-xs font-semibold flex items-center gap-1 transition-all border border-slate-200"
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:inline">Ganti Akun</span>
            </button>
          </div>
        </div>

        {/* NAVIGATION TABS */}
        <div className="bg-slate-100/90 border-t border-slate-200 px-4 sm:px-8 overflow-x-auto">
          <div className="max-w-7xl mx-auto flex space-x-2 py-2">
            {currentUserRole.role === 'admin' && (
              <>
                <TabButton id="dashboard" label="Dashboard Utama" icon={BarChart3} active={activeTab} setActive={setActiveTab} />
                <TabButton id="juri" label="1. Kelola Dewan Juri" icon={ShieldCheck} active={activeTab} setActive={setActiveTab} />
                <TabButton id="finalis" label="2. Kelola Data Finalis" icon={Users} active={activeTab} setActive={setActiveTab} />
                <TabButton id="rekap11" label="3. Rekap Speech (11 Besar)" icon={Mic} active={activeTab} setActive={setActiveTab} />
                <TabButton id="rekap6" label="4. Rekap Q&A (Top 6)" icon={MessageSquare} active={activeTab} setActive={setActiveTab} />
                <TabButton id="pemenang" label="5. Urutan Pemenang" icon={Trophy} active={activeTab} setActive={setActiveTab} />
                <TabButton id="berita" label="6. Cetak Berita Acara" icon={Printer} active={activeTab} setActive={setActiveTab} />
              </>
            )}

            {currentUserRole.role === 'juri' && (
              <>
                <TabButton id="penilaian11" label="1. Nilai Speech (11 Besar)" icon={Mic} active={activeTab} setActive={setActiveTab} />
                <TabButton id="penilaian6" label="2. Nilai Q&A (Top 6)" icon={MessageSquare} active={activeTab} setActive={setActiveTab} />
                <TabButton id="pemenang" label="Hasil Pemenang" icon={Award} active={activeTab} setActive={setActiveTab} />
              </>
            )}
          </div>
        </div>
      </header>

      {/* MAIN BODY CONTENT */}
      <main className="flex-grow max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        
        {/* DASHBOARD (ADMIN) */}
        {activeTab === 'dashboard' && currentUserRole.role === 'admin' && (
          <div className="space-y-6">
            <div className="bg-gradient-to-r from-red-600 via-rose-600 to-amber-500 rounded-3xl p-6 text-white shadow-xl relative overflow-hidden">
              <div className="relative z-10">
                <h2 className="text-xl sm:text-2xl font-black mb-1 flex items-center gap-2">
                  <Sparkles className="w-6 h-6 text-amber-300" />
                  Live Command Center Duta Teknokrat 2026
                </h2>
                <p className="text-xs text-red-100 max-w-2xl">
                  Sistem Real-Time Pengolahan Nilai Speech (11 Besar) & QnA Grand Final (Top 6). 
                </p>
                
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
                  <StatCard title="Finalis Putra" value={finalisPutra.length} sub="Terdaftar di Database" />
                  <StatCard title="Finalis Putri" value={finalisPutri.length} sub="Terdaftar di Database" />
                  <StatCard title="Dewan Juri" value={juris.length} sub="Juri Terdaftar" />
                  <StatCard title="Kualifikasi Top 6" value={top6Finalis.combined.length} sub="3 Putra + 3 Putri" />
                </div>
              </div>
            </div>

            {/* Quick Status Info */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
                <h3 className="font-bold text-slate-800 mb-4 text-xs uppercase tracking-wider flex items-center justify-between">
                  <span className="flex items-center gap-1.5"><Mic className="w-4 h-4 text-red-600" /> Status Penilaian Speech (11 Besar)</span>
                  <span className="text-red-600 font-mono text-[11px] font-bold">{juris.length} Juri</span>
                </h3>
                {juris.length === 0 ? (
                  <p className="text-xs text-slate-400 italic">Belum ada data Juri.</p>
                ) : (
                  <div className="space-y-4">
                    {juris.map(j => {
                      const scoredCount = Object.keys(scores11[j.id] || {}).length;
                      const totalNeeded = finalis.length || 1;
                      const pct = Math.round((scoredCount / totalNeeded) * 100);
                      return (
                        <div key={j.id} className="text-xs space-y-1.5">
                          <div className="flex justify-between font-semibold">
                            <span className="text-slate-700">{j.name}</span>
                            <span className="text-red-600 font-mono">{scoredCount} / {finalis.length} Peserta ({pct}%)</span>
                          </div>
                          <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden p-0.5 border border-slate-200">
                            <div className="h-full bg-red-600 rounded-full transition-all duration-300" style={{ width: `${pct}%` }}></div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
                <h3 className="font-bold text-slate-800 mb-4 text-xs uppercase tracking-wider flex items-center justify-between">
                  <span className="flex items-center gap-1.5"><MessageSquare className="w-4 h-4 text-teal-600" /> Status Penilaian Q&A (Top 6)</span>
                  <span className="text-teal-600 font-mono text-[11px] font-bold">Top 3 Putra & Putri</span>
                </h3>
                {juris.length === 0 ? (
                  <p className="text-xs text-slate-400 italic">Belum ada data Juri.</p>
                ) : (
                  <div className="space-y-4">
                    {juris.map(j => {
                      const scoredCount = Object.keys(scores6[j.id] || {}).length;
                      const pct = Math.round((scoredCount / 6) * 100);
                      return (
                        <div key={j.id} className="text-xs space-y-1.5">
                          <div className="flex justify-between font-semibold">
                            <span className="text-slate-700">{j.name}</span>
                            <span className="text-teal-600 font-mono">{scoredCount} / 6 Peserta ({pct}%)</span>
                          </div>
                          <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden p-0.5 border border-slate-200">
                            <div className="h-full bg-teal-500 rounded-full transition-all duration-300" style={{ width: `${pct}%` }}></div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* MANAJEMEN DEWAN JURI (ADMIN) */}
        {activeTab === 'juri' && currentUserRole.role === 'admin' && (
          <div className="space-y-6">
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
              <h2 className="text-base font-bold text-slate-900">Kelola Akun Dewan Juri</h2>
              <p className="text-xs text-slate-500">Tambahkan akun juri yang bertugas. Juri terdaftar dapat langsung login untuk menilai.</p>
            </div>

            <form onSubmit={handleAddJuri} className="bg-white border border-slate-200 rounded-2xl p-4 grid grid-cols-1 sm:grid-cols-3 gap-3 shadow-sm">
              <input 
                type="text" placeholder="Nama Lengkap & Gelar Juri" required
                value={newJuri.name}
                onChange={e => setNewJuri({...newJuri, name: e.target.value})}
                className="bg-slate-50 border border-slate-300 rounded-xl px-3 py-2.5 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-red-500"
              />
              <input 
                type="text" placeholder="Jabatan / Bidang Penilaian Juri"
                value={newJuri.role}
                onChange={e => setNewJuri({...newJuri, role: e.target.value})}
                className="bg-slate-50 border border-slate-300 rounded-xl px-3 py-2.5 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-red-500"
              />
              <button type="submit" className="bg-red-600 hover:bg-red-700 text-white font-bold text-xs px-4 py-2.5 rounded-xl flex items-center justify-center gap-1 transition-all shadow-sm">
                <Plus className="w-4 h-4" />
                <span>Tambah Dewan Juri</span>
              </button>
            </form>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {juris.length === 0 ? (
                <div className="col-span-3 text-center py-8 text-xs text-slate-400 bg-white rounded-2xl border border-dashed border-slate-300">
                  Belum ada juri terdaftar. Tambahkan juri pertama di atas.
                </div>
              ) : (
                juris.map((j) => (
                  <div key={j.id} className="bg-white border border-slate-200 rounded-2xl p-4 flex justify-between items-center shadow-sm hover:border-red-300 transition-all">
                    <div>
                      <h3 className="font-bold text-slate-900 text-sm">{j.name}</h3>
                      <p className="text-xs text-red-600 font-medium">{j.role || 'Dewan Juri'}</p>
                    </div>
                    <button onClick={() => handleDeleteJuri(j.id)} className="text-slate-400 hover:text-red-600 p-2 transition-all">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* MANAJEMEN FINALIS (ADMIN) */}
        {activeTab === 'finalis' && currentUserRole.role === 'admin' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
              <div>
                <h2 className="text-base font-bold text-slate-900">Kelola Data Finalis 11 Besar</h2>
                <p className="text-xs text-slate-500">Nomor urut peserta diset otomatis oleh sistem.</p>
              </div>
              <button 
                onClick={() => setShowImportModal(true)}
                className="bg-teal-600 hover:bg-teal-700 text-white text-xs px-4 py-2.5 rounded-xl font-bold flex items-center gap-2 transition-all shadow-md"
              >
                <Upload className="w-4 h-4" />
                <span>Import Excel / CSV</span>
              </button>
            </div>

            {/* FORM TAMBAH FINALIS DENGAN NOMOR AUTOMATIS, DROPDOWN PRODI, GENDER SELEPAS PRODI */}
            <form onSubmit={handleAddFinalis} className="bg-white border border-slate-200 rounded-2xl p-4 grid grid-cols-1 sm:grid-cols-5 gap-3 shadow-sm">
              <div className="flex items-center justify-center bg-red-100 border border-red-200 text-red-700 font-mono font-bold rounded-xl px-3 py-2 text-xs">
                No: {(finalis.length + 1).toString().padStart(2, '0')} (Auto)
              </div>
              <input 
                type="text" placeholder="Nama Lengkap Finalis" required
                value={newFinalis.name}
                onChange={e => setNewFinalis({...newFinalis, name: e.target.value})}
                className="bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-red-500"
              />
              <select 
                value={newFinalis.prodi}
                onChange={e => setNewFinalis({...newFinalis, prodi: e.target.value})}
                className="bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-red-500 font-bold"
              >
                {PRODI_LIST.map((prodi, idx) => (
                  <option key={idx} value={prodi}>{prodi}</option>
                ))}
              </select>
              <select 
                value={newFinalis.gender}
                onChange={e => setNewFinalis({...newFinalis, gender: e.target.value})}
                className="bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-red-500 font-bold"
              >
                <option value="Putra">Kategori Putra</option>
                <option value="Putri">Kategori Putri</option>
              </select>
              <button type="submit" className="bg-red-600 hover:bg-red-700 text-white font-bold text-xs px-4 py-2 rounded-xl flex items-center justify-center gap-1 transition-all shadow-sm">
                <Plus className="w-4 h-4" />
                <span>Tambah Peserta</span>
              </button>
            </form>

            {/* DUA KOLOM TERPISAH PUTRA & PUTRI */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              
              {/* TABEL FINALIS PUTRA */}
              <div className="bg-white border border-sky-200 rounded-2xl overflow-hidden shadow-sm">
                <div className="bg-sky-600 text-white px-4 py-3 font-bold text-xs uppercase flex items-center justify-between">
                  <span>Daftar Peserta Finalis (Putra)</span>
                  <span className="bg-white/20 px-2 py-0.5 rounded-full text-[10px]">{finalisPutra.length} Peserta</span>
                </div>
                <div className="divide-y divide-slate-100">
                  {finalisPutra.length === 0 ? (
                    <div className="p-6 text-center text-xs text-slate-400 italic">Belum ada peserta Putra.</div>
                  ) : (
                    finalisPutra.map((item) => (
                      <div key={item.id} className="p-3.5 flex justify-between items-center text-xs hover:bg-sky-50/40 transition-all">
                        <div className="flex items-center space-x-3">
                          <span className="font-mono font-bold text-sky-700 bg-sky-100 px-2.5 py-1 rounded-lg text-xs">{item.no}</span>
                          <div>
                            <span className="font-bold text-slate-900 block text-sm">{item.name}</span>
                            <span className="text-slate-500 text-[11px]">{item.prodi}</span>
                          </div>
                        </div>
                        <button onClick={() => handleDeleteFinalis(item.id)} className="text-slate-400 hover:text-red-600 p-1.5 transition-all">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* TABEL FINALIS PUTRI */}
              <div className="bg-white border border-pink-200 rounded-2xl overflow-hidden shadow-sm">
                <div className="bg-pink-600 text-white px-4 py-3 font-bold text-xs uppercase flex items-center justify-between">
                  <span>Daftar Peserta Finalis (Putri)</span>
                  <span className="bg-white/20 px-2 py-0.5 rounded-full text-[10px]">{finalisPutri.length} Peserta</span>
                </div>
                <div className="divide-y divide-slate-100">
                  {finalisPutri.length === 0 ? (
                    <div className="p-6 text-center text-xs text-slate-400 italic">Belum ada peserta Putri.</div>
                  ) : (
                    finalisPutri.map((item) => (
                      <div key={item.id} className="p-3.5 flex justify-between items-center text-xs hover:bg-pink-50/40 transition-all">
                        <div className="flex items-center space-x-3">
                          <span className="font-mono font-bold text-pink-700 bg-pink-100 px-2.5 py-1 rounded-lg text-xs">{item.no}</span>
                          <div>
                            <span className="font-bold text-slate-900 block text-sm">{item.name}</span>
                            <span className="text-slate-500 text-[11px]">{item.prodi}</span>
                          </div>
                        </div>
                        <button onClick={() => handleDeleteFinalis(item.id)} className="text-slate-400 hover:text-red-600 p-1.5 transition-all">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>

            </div>
          </div>
        )}

        {/* REKAP SPEECH 11 BESAR (URUTAN OTOMATIS TERTINGGI S.D. TERENDAH - TERPISAH PUTRA & PUTRI) */}
        {activeTab === 'rekap11' && (
          <div className="space-y-6">
            <div className="bg-white p-5 rounded-2xl border border-slate-200 flex flex-col sm:flex-row justify-between sm:items-center gap-2 shadow-sm">
              <div>
                <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <Mic className="w-5 h-5 text-red-600" />
                  <span>Rekapitulasi Skor Speech (Babak 11 Besar)</span>
                </h2>
                <p className="text-xs text-slate-500">Tabel Peringkat Otomatis dari Nilai Tertinggi ke Terendah (Top 3 Putra & Top 3 Putri Lolos Q&A)</p>
              </div>
              {currentUserRole.role === 'admin' && (
                <button onClick={() => setActiveTab('rekap6')} className="bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs px-4 py-2.5 rounded-xl flex items-center gap-1.5 transition-all shadow-md">
                  <span>Kualifikasi 6 Besar</span>
                  <Award className="w-4 h-4" />
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              
              {/* REKAP SPEECH PUTRA TERURUT OTOMATIS */}
              <div className="bg-white border border-sky-200 rounded-2xl overflow-hidden shadow-sm">
                <div className="bg-sky-600 text-white px-4 py-3 font-bold text-xs uppercase flex items-center justify-between">
                  <span>Peringkat Speech (Putra)</span>
                  <span className="bg-amber-400 text-slate-900 text-[10px] px-2 py-0.5 rounded-full font-extrabold">Top 3 Lolos Q&A</span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-100 text-slate-700 uppercase font-bold border-b border-slate-200">
                      <tr>
                        <th className="p-3 text-center">Rank</th>
                        <th className="p-3">No / Nama Finalis</th>
                        {juris.map(j => (
                          <th key={j.id} className="p-3 text-center">{j.name.split(',')[0]}</th>
                        ))}
                        <th className="p-3 text-center bg-sky-50 text-sky-800 font-extrabold">Rata-Rata</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {sortedRekap11.putra.length === 0 ? (
                        <tr><td colSpan={3 + juris.length} className="p-6 text-center text-xs text-slate-400 italic">Belum ada data peserta Putra.</td></tr>
                      ) : (
                        sortedRekap11.putra.map((f, idx) => (
                          <tr key={f.id} className={`hover:bg-slate-50 transition-all ${idx < 3 ? 'bg-sky-50/40' : ''}`}>
                            <td className="p-3 text-center">
                              <span className={`w-6 h-6 rounded-full inline-flex items-center justify-center font-bold text-xs ${
                                idx === 0 ? 'bg-amber-400 text-slate-900' : idx < 3 ? 'bg-sky-600 text-white' : 'bg-slate-200 text-slate-600'
                              }`}>
                                {idx + 1}
                              </span>
                            </td>
                            <td className="p-3 font-bold text-slate-900">
                              <span className="text-sky-700 mr-1 font-mono">[{f.no}]</span>{f.name}
                              <div className="text-[10px] text-slate-500 font-normal">{f.prodi}</div>
                            </td>
                            {juris.map(j => (
                              <td key={j.id} className="p-3 text-center font-mono font-semibold text-slate-700">
                                {f.breakdown[j.id] || 0}
                              </td>
                            ))}
                            <td className="p-3 text-center font-mono font-extrabold text-sm text-sky-700 bg-sky-50">
                              {f.avgScore}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* REKAP SPEECH PUTRI TERURUT OTOMATIS */}
              <div className="bg-white border border-pink-200 rounded-2xl overflow-hidden shadow-sm">
                <div className="bg-pink-600 text-white px-4 py-3 font-bold text-xs uppercase flex items-center justify-between">
                  <span>Peringkat Speech (Putri)</span>
                  <span className="bg-amber-400 text-slate-900 text-[10px] px-2 py-0.5 rounded-full font-extrabold">Top 3 Lolos Q&A</span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-100 text-slate-700 uppercase font-bold border-b border-slate-200">
                      <tr>
                        <th className="p-3 text-center">Rank</th>
                        <th className="p-3">No / Nama Finalis</th>
                        {juris.map(j => (
                          <th key={j.id} className="p-3 text-center">{j.name.split(',')[0]}</th>
                        ))}
                        <th className="p-3 text-center bg-pink-50 text-pink-800 font-extrabold">Rata-Rata</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {sortedRekap11.putri.length === 0 ? (
                        <tr><td colSpan={3 + juris.length} className="p-6 text-center text-xs text-slate-400 italic">Belum ada data peserta Putri.</td></tr>
                      ) : (
                        sortedRekap11.putri.map((f, idx) => (
                          <tr key={f.id} className={`hover:bg-slate-50 transition-all ${idx < 3 ? 'bg-pink-50/40' : ''}`}>
                            <td className="p-3 text-center">
                              <span className={`w-6 h-6 rounded-full inline-flex items-center justify-center font-bold text-xs ${
                                idx === 0 ? 'bg-amber-400 text-slate-900' : idx < 3 ? 'bg-pink-600 text-white' : 'bg-slate-200 text-slate-600'
                              }`}>
                                {idx + 1}
                              </span>
                            </td>
                            <td className="p-3 font-bold text-slate-900">
                              <span className="text-pink-700 mr-1 font-mono">[{f.no}]</span>{f.name}
                              <div className="text-[10px] text-slate-500 font-normal">{f.prodi}</div>
                            </td>
                            {juris.map(j => (
                              <td key={j.id} className="p-3 text-center font-mono font-semibold text-slate-700">
                                {f.breakdown[j.id] || 0}
                              </td>
                            ))}
                            <td className="p-3 text-center font-mono font-extrabold text-sm text-pink-700 bg-pink-50">
                              {f.avgScore}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

            </div>
          </div>
        )}

        {/* REKAP Q&A TOP 6 (URUTAN OTOMATIS TERTINGGI S.D. TERENDAH - TERPISAH PUTRA & PUTRI) */}
        {activeTab === 'rekap6' && (
          <div className="space-y-6">
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col sm:flex-row justify-between sm:items-center gap-2">
              <div>
                <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <MessageSquare className="w-5 h-5 text-teal-600" />
                  <span>Hasil Rekapitulasi Q&A Babak Grand Final (Top 6)</span>
                </h2>
                <p className="text-xs text-slate-500">Nama otomatis dari 6 Tertinggi babak sebelumnya. Urutan Peringkat otomatis dari skor tertinggi ke terendah.</p>
              </div>
              <button onClick={() => setActiveTab('pemenang')} className="bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs px-4 py-2.5 rounded-xl flex items-center gap-1.5 transition-all shadow-md">
                <span>Lihat Penetapan Pemenang</span>
                <Trophy className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              
              {/* REKAP TOP 3 PUTRA */}
              <div className="bg-white border border-sky-200 rounded-2xl overflow-hidden shadow-sm">
                <div className="bg-sky-600 text-white px-4 py-3 font-bold text-xs uppercase flex items-center justify-between">
                  <span>Peringkat Nilai Top 3 (Putra)</span>
                  <Trophy className="w-4 h-4 text-amber-300" />
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-100 text-slate-700 uppercase font-bold border-b border-slate-200">
                      <tr>
                        <th className="p-3 text-center">Rank</th>
                        <th className="p-3">Nama Finalis</th>
                        <th className="p-3 text-center">Rata Q&A</th>
                        <th className="p-3 text-center bg-sky-50 text-sky-800 font-extrabold">Nilai Akhir</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {sortedRekap6.putra.length === 0 ? (
                        <tr><td colSpan={4} className="p-6 text-center text-xs text-slate-400 italic">Belum ada skor Q&A Putra.</td></tr>
                      ) : (
                        sortedRekap6.putra.map((f, idx) => (
                          <tr key={f.id} className="hover:bg-slate-50 transition-all">
                            <td className="p-3 text-center font-extrabold text-sky-700">{idx + 1}</td>
                            <td className="p-3 font-bold text-slate-900">
                              {f.name}
                              <div className="text-[10px] text-slate-500 font-normal">{f.prodi}</div>
                            </td>
                            <td className="p-3 text-center font-mono font-semibold text-slate-700">{f.avgScore6}</td>
                            <td className="p-3 text-center font-mono font-extrabold text-sm text-sky-700 bg-sky-50">
                              {f.finalAccumulated}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* REKAP TOP 3 PUTRI */}
              <div className="bg-white border border-pink-200 rounded-2xl overflow-hidden shadow-sm">
                <div className="bg-pink-600 text-white px-4 py-3 font-bold text-xs uppercase flex items-center justify-between">
                  <span>Peringkat Nilai Top 3 (Putri)</span>
                  <Trophy className="w-4 h-4 text-amber-300" />
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-100 text-slate-700 uppercase font-bold border-b border-slate-200">
                      <tr>
                        <th className="p-3 text-center">Rank</th>
                        <th className="p-3">Nama Finalis</th>
                        <th className="p-3 text-center">Rata Q&A</th>
                        <th className="p-3 text-center bg-pink-50 text-pink-800 font-extrabold">Nilai Akhir</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {sortedRekap6.putri.length === 0 ? (
                        <tr><td colSpan={4} className="p-6 text-center text-xs text-slate-400 italic">Belum ada skor Q&A Putri.</td></tr>
                      ) : (
                        sortedRekap6.putri.map((f, idx) => (
                          <tr key={f.id} className="hover:bg-slate-50 transition-all">
                            <td className="p-3 text-center font-extrabold text-pink-700">{idx + 1}</td>
                            <td className="p-3 font-bold text-slate-900">
                              {f.name}
                              <div className="text-[10px] text-slate-500 font-normal">{f.prodi}</div>
                            </td>
                            <td className="p-3 text-center font-mono font-semibold text-slate-700">{f.avgScore6}</td>
                            <td className="p-3 text-center font-mono font-extrabold text-sm text-pink-700 bg-pink-50">
                              {f.finalAccumulated}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

            </div>
          </div>
        )}

        {/* URUTAN PEMENANG TERPISAH PUTRA & PUTRI (WINNER S.D. 5th RUNNER UP) */}
        {activeTab === 'pemenang' && (
          <div className="space-y-6">
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex justify-between items-center">
              <div>
                <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <Trophy className="w-5 h-5 text-amber-500" />
                  <span>Penetapan Resmi Urutan Pemenang Duta Teknokrat 2026</span>
                </h2>
                <p className="text-xs text-slate-500">Urutan 1 (Winner) hingga Urutan 6 (5th Runner Up) ditentukan secara terpisah antara Kategori Putra & Putri</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              
              {/* KATEGORI PUTRA */}
              <div className="space-y-3">
                <div className="bg-sky-600 text-white p-3 rounded-xl font-bold text-xs uppercase flex items-center justify-between shadow-sm">
                  <span>Hasil Pemenang Kategori Putra</span>
                  <Award className="w-4 h-4 text-amber-300" />
                </div>
                {winnersRanked.putra.length === 0 ? (
                  <div className="p-8 text-center text-xs text-slate-400 bg-white rounded-2xl border border-slate-200">
                    Belum ada data nilai akumulasi Putra.
                  </div>
                ) : (
                  winnersRanked.putra.map((item, idx) => (
                    <div key={item.id} className={`p-4 rounded-2xl border transition-all ${
                      idx === 0 
                        ? 'bg-gradient-to-r from-amber-50 via-amber-100/70 to-sky-50 border-amber-400 shadow-md ring-2 ring-amber-400/30' 
                        : 'bg-white border-slate-200 shadow-sm'
                    }`}>
                      <div className="flex justify-between items-center text-xs">
                        <div>
                          <span className={`text-[10px] font-black uppercase tracking-wider block mb-0.5 ${
                            idx === 0 ? 'text-amber-700 font-extrabold' : 'text-sky-700 font-bold'
                          }`}>
                            {item.title}
                          </span>
                          <h4 className="font-bold text-slate-900 text-base">{item.name}</h4>
                          <span className="text-slate-500 font-medium text-[11px]">No. {item.no} • {item.prodi}</span>
                        </div>
                        <div className="text-right">
                          <span className="text-[10px] text-slate-400 block font-bold uppercase">Skor Akhir</span>
                          <span className="font-mono font-extrabold text-lg text-sky-700">
                            {item.finalAccumulated}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* KATEGORI PUTRI */}
              <div className="space-y-3">
                <div className="bg-pink-600 text-white p-3 rounded-xl font-bold text-xs uppercase flex items-center justify-between shadow-sm">
                  <span>Hasil Pemenang Kategori Putri</span>
                  <Award className="w-4 h-4 text-amber-300" />
                </div>
                {winnersRanked.putri.length === 0 ? (
                  <div className="p-8 text-center text-xs text-slate-400 bg-white rounded-2xl border border-slate-200">
                    Belum ada data nilai akumulasi Putri.
                  </div>
                ) : (
                  winnersRanked.putri.map((item, idx) => (
                    <div key={item.id} className={`p-4 rounded-2xl border transition-all ${
                      idx === 0 
                        ? 'bg-gradient-to-r from-amber-50 via-amber-100/70 to-pink-50 border-amber-400 shadow-md ring-2 ring-amber-400/30' 
                        : 'bg-white border-slate-200 shadow-sm'
                    }`}>
                      <div className="flex justify-between items-center text-xs">
                        <div>
                          <span className={`text-[10px] font-black uppercase tracking-wider block mb-0.5 ${
                            idx === 0 ? 'text-amber-700 font-extrabold' : 'text-pink-700 font-bold'
                          }`}>
                            {item.title}
                          </span>
                          <h4 className="font-bold text-slate-900 text-base">{item.name}</h4>
                          <span className="text-slate-500 font-medium text-[11px]">No. {item.no} • {item.prodi}</span>
                        </div>
                        <div className="text-right">
                          <span className="text-[10px] text-slate-400 block font-bold uppercase">Skor Akhir</span>
                          <span className="font-mono font-extrabold text-lg text-pink-700">
                            {item.finalAccumulated}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>

            </div>
          </div>
        )}

        {/* FORM PENILAIAN SPEECH 11 BESAR (JURI) */}
        {activeTab === 'penilaian11' && currentUserRole.role === 'juri' && (
          <FormPenilaianSpeech 
            juriId={currentUserRole.juriId} 
            juriName={currentUserRole.name} 
            finalisPutra={finalisPutra}
            finalisPutri={finalisPutri}
            scores11={scores11[currentUserRole.juriId] || {}} 
            db={db} 
            appId={appId} 
            user={user}
            showToast={showToast}
          />
        )}

        {/* FORM PENILAIAN Q&A 6 BESAR (JURI) */}
        {activeTab === 'penilaian6' && currentUserRole.role === 'juri' && (
          <FormPenilaianQnA 
            juriId={currentUserRole.juriId} 
            juriName={currentUserRole.name} 
            top3Putra={top6Finalis.putra} 
            top3Putri={top6Finalis.putri}
            scores6={scores6[currentUserRole.juriId] || {}} 
            db={db} 
            appId={appId} 
            user={user}
            showToast={showToast}
          />
        )}

        {/* CETAK BERITA ACARA (ADMIN) */}
        {activeTab === 'berita' && currentUserRole.role === 'admin' && (
          <div className="space-y-6">
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
              <h2 className="text-base font-bold text-slate-900">Cetak Berita Acara Resmi</h2>
              <p className="text-xs text-slate-500">Pilih dokumen resmi untuk di-print atau di-export ke PDF lengkap dengan Kop & Tanda Tangan Juri</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <button onClick={() => setPrintType('11besar')} className="bg-white border border-slate-200 hover:border-red-500 p-6 rounded-2xl text-left space-y-2 transition-all shadow-sm hover:shadow-md group">
                <FileText className="w-8 h-8 text-red-600 group-hover:scale-110 transition-all" />
                <h3 className="font-bold text-slate-900 text-sm">Berita Acara 11 Besar (Speech)</h3>
                <p className="text-xs text-slate-500">Rekapitulasi nilai pidato & urutan skor terpisah Putra & Putri.</p>
              </button>

              <button onClick={() => setPrintType('6besar')} className="bg-white border border-slate-200 hover:border-teal-500 p-6 rounded-2xl text-left space-y-2 transition-all shadow-sm hover:shadow-md group">
                <Award className="w-8 h-8 text-teal-600 group-hover:scale-110 transition-all" />
                <h3 className="font-bold text-slate-900 text-sm">Berita Acara Top 6 (Q&A)</h3>
                <p className="text-xs text-slate-500">Daftar penetapan Top 3 Putra & Top 3 Putri Grand Finalist.</p>
              </button>

              <button onClick={() => setPrintType('pemenang')} className="bg-white border border-slate-200 hover:border-amber-500 p-6 rounded-2xl text-left space-y-2 transition-all shadow-sm hover:shadow-md group">
                <Trophy className="w-8 h-8 text-amber-500 group-hover:scale-110 transition-all" />
                <h3 className="font-bold text-slate-900 text-sm">Berita Acara Pemenang Akhir</h3>
                <p className="text-xs text-slate-500">Penetapan resmi Winner & Runner Up Putra dan Putri.</p>
              </button>
            </div>
          </div>
        )}

      </main>

      {/* MODAL IMPORT EXCEL */}
      {showImportModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-lg p-6 space-y-4 shadow-2xl">
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Upload className="w-5 h-5 text-red-600" />
              <span>Import Data Finalis (CSV / Excel Text)</span>
            </h3>
            <p className="text-xs text-slate-500">
              Copy & Paste data dari Excel. Format kolom per baris: <br/>
              <code className="text-red-600 bg-red-50 px-1.5 py-0.5 rounded border border-red-200 font-bold">Nama [Tab/Koma] Prodi [Tab/Koma] Gender (Putra/Putri)</code>
            </p>
            <textarea 
              rows={6}
              value={importText}
              onChange={e => setImportText(e.target.value)}
              placeholder={"Ahmad Rizky, S1 Informatika, Putra\nAnisa Putri, S1 Sistem Informasi, Putri"}
              className="w-full bg-slate-50 border border-slate-300 rounded-xl p-3 text-xs text-slate-900 font-mono focus:ring-2 focus:ring-red-500 focus:outline-none"
            />
            <div className="flex justify-end space-x-2">
              <button onClick={() => setShowImportModal(false)} className="px-4 py-2 bg-slate-100 text-slate-700 rounded-xl text-xs font-bold">Batal</button>
              <button onClick={handleImportExcelParser} className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl text-xs shadow-md">Proses Import Data</button>
            </div>
          </div>
        </div>
      )}

      {/* PRINT PREVIEW MODAL */}
      {printType && (
        <div className="fixed inset-0 bg-slate-900/80 z-50 overflow-y-auto p-4 sm:p-8 flex justify-center">
          <div className="bg-white text-slate-900 rounded-2xl w-full max-w-4xl p-8 shadow-2xl self-start relative my-auto">
            <div className="flex justify-between items-center pb-4 mb-4 border-b border-slate-200 print:hidden">
              <span className="text-xs font-bold text-slate-500 uppercase">Dokumen Resmi Berita Acara</span>
              <div className="flex space-x-2">
                <button onClick={() => window.print()} className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-md">
                  <Printer className="w-4 h-4" /> Cetak Dokumen PDF
                </button>
                <button onClick={() => setPrintType(null)} className="bg-slate-100 text-slate-700 px-4 py-2 rounded-xl text-xs font-bold">
                  Tutup
                </button>
              </div>
            </div>

            <div className="space-y-6 text-slate-900 text-xs">
              <div className="text-center border-b-2 border-slate-900 pb-3">
                <h2 className="text-lg font-extrabold uppercase tracking-wide">UNIVERSITAS TEKNOKRAT INDONESIA</h2>
                <h3 className="text-sm font-bold text-red-600 uppercase">PANITIA PEMILIHAN DUTA TEKNOKRAT 2026</h3>
                <p className="text-[10px] text-slate-600">Jl. ZA. Pagar Alam No.9-11, Labuhan Ratu, Bandar Lampung</p>
              </div>

              <div className="text-center">
                <h4 className="text-sm font-bold underline uppercase">
                  BERITA ACARA PENETAPAN {printType === '11besar' ? 'REKAPITULASI BABAK 11 BESAR (SPEECH)' : printType === '6besar' ? 'FINALIS GRAND FINAL 6 BESAR (Q&A)' : 'PEMENANG DUTA TEKNOKRAT 2026'}
                </h4>
                <p className="text-[11px] text-slate-600 mt-1">Pada hari ini, disepakati hasil penilaian resmi sebagai berikut:</p>
              </div>

              {printType === '11besar' && (
                <div className="space-y-4">
                  <div>
                    <h5 className="font-bold text-sky-700 border-b pb-1 mb-2">Kategori Putra:</h5>
                    <table className="w-full border-collapse border border-slate-400 text-xs">
                      <thead>
                        <tr className="bg-slate-100">
                          <th className="border border-slate-400 p-2 text-center">Rank</th>
                          <th className="border border-slate-400 p-2">Nama Finalis</th>
                          <th className="border border-slate-400 p-2">Program Studi</th>
                          <th className="border border-slate-400 p-2 text-center">Skor Speech</th>
                        </tr>
                      </thead>
                      <tbody>
                        {sortedRekap11.putra.map((f, i) => (
                          <tr key={f.id}>
                            <td className="border border-slate-400 p-2 text-center font-bold">{i + 1}</td>
                            <td className="border border-slate-400 p-2 font-semibold">[{f.no}] {f.name}</td>
                            <td className="border border-slate-400 p-2">{f.prodi}</td>
                            <td className="border border-slate-400 p-2 text-center font-bold">{f.avgScore}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div>
                    <h5 className="font-bold text-pink-700 border-b pb-1 mb-2">Kategori Putri:</h5>
                    <table className="w-full border-collapse border border-slate-400 text-xs">
                      <thead>
                        <tr className="bg-slate-100">
                          <th className="border border-slate-400 p-2 text-center">Rank</th>
                          <th className="border border-slate-400 p-2">Nama Finalis</th>
                          <th className="border border-slate-400 p-2">Program Studi</th>
                          <th className="border border-slate-400 p-2 text-center">Skor Speech</th>
                        </tr>
                      </thead>
                      <tbody>
                        {sortedRekap11.putri.map((f, i) => (
                          <tr key={f.id}>
                            <td className="border border-slate-400 p-2 text-center font-bold">{i + 1}</td>
                            <td className="border border-slate-400 p-2 font-semibold">[{f.no}] {f.name}</td>
                            <td className="border border-slate-400 p-2">{f.prodi}</td>
                            <td className="border border-slate-400 p-2 text-center font-bold">{f.avgScore}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {printType === '6besar' && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <h5 className="font-bold text-sky-700 mb-2">Finalis Lolos Top 3 Putra:</h5>
                    <ol className="list-decimal list-inside space-y-1">
                      {top6Finalis.putra.map(f => (
                        <li key={f.id} className="font-semibold">{f.name} ({f.prodi}) - Skor: {f.avgScore}</li>
                      ))}
                    </ol>
                  </div>
                  <div>
                    <h5 className="font-bold text-pink-700 mb-2">Finalis Lolos Top 3 Putri:</h5>
                    <ol className="list-decimal list-inside space-y-1">
                      {top6Finalis.putri.map(f => (
                        <li key={f.id} className="font-semibold">{f.name} ({f.prodi}) - Skor: {f.avgScore}</li>
                      ))}
                    </ol>
                  </div>
                </div>
              )}

              {printType === 'pemenang' && (
                <table className="w-full border-collapse border border-slate-400 text-xs">
                  <thead>
                    <tr className="bg-slate-100">
                      <th className="border border-slate-400 p-2">Gelar Kejuaraan</th>
                      <th className="border border-slate-400 p-2">Duta Putra</th>
                      <th className="border border-slate-400 p-2">Duta Putri</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Array.from({ length: Math.max(winnersRanked.putra.length, winnersRanked.putri.length, 1) }).map((_, idx) => (
                      <tr key={idx}>
                        <td className="border border-slate-400 p-2 font-bold bg-amber-50">
                          {winnersRanked.putra[idx]?.title || winnersRanked.putri[idx]?.title || `Peringkat ${idx + 1}`}
                        </td>
                        <td className="border border-slate-400 p-2 font-semibold">
                          {winnersRanked.putra[idx] ? `${winnersRanked.putra[idx].name} (${winnersRanked.putra[idx].finalAccumulated})` : '-'}
                        </td>
                        <td className="border border-slate-400 p-2 font-semibold">
                          {winnersRanked.putri[idx] ? `${winnersRanked.putri[idx].name} (${winnersRanked.putri[idx].finalAccumulated})` : '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}

              <div className="pt-10">
                <p className="text-xs font-bold text-center mb-8 uppercase">DEWAN JURI PENILAI:</p>
                <div className="grid grid-cols-3 gap-6 text-center text-xs">
                  {juris.map((j) => (
                    <div key={j.id} className="space-y-12">
                      <p className="font-semibold text-slate-700">{j.role || 'Dewan Juri'}</p>
                      <div>
                        <p className="font-bold underline">{j.name}</p>
                        <p className="text-[10px] text-slate-500">Tanda Tangan & Nama Terang</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

// --- SUB-KOMPONEN FORM PENILAIAN SPEECH 11 BESAR (JURI) ---
function FormPenilaianSpeech({ juriId, juriName, finalisPutra, finalisPutri, scores11, db, appId, user, showToast }) {
  const [localInputs, setLocalInputs] = useState({});
  const [activeGenderTab, setActiveGenderTab] = useState('Putra');

  useEffect(() => {
    const formatted = {};
    Object.keys(scores11).forEach(fId => {
      formatted[fId] = {
        materiSpeech: scores11[fId]?.materiSpeech?.toString() || '',
        delivery: scores11[fId]?.delivery?.toString() || '',
        publicSpeaking: scores11[fId]?.publicSpeaking?.toString() || ''
      };
    });
    setLocalInputs(formatted);
  }, [scores11]);

  const handleChange = async (finalisId, field, rawValue) => {
    const newInputs = {
      ...localInputs,
      [finalisId]: {
        ...(localInputs[finalisId] || { materiSpeech: '', delivery: '', publicSpeaking: '' }),
        [field]: rawValue
      }
    };
    setLocalInputs(newInputs);

    if (!user) return;
    const docId = `${juriId}_${finalisId}`;
    const targetObj = newInputs[finalisId];
    
    const numObj = {
      materiSpeech: targetObj.materiSpeech === '' ? 0 : Math.min(100, Math.max(0, parseFloat(targetObj.materiSpeech) || 0)),
      delivery: targetObj.delivery === '' ? 0 : Math.min(100, Math.max(0, parseFloat(targetObj.delivery) || 0)),
      publicSpeaking: targetObj.publicSpeaking === '' ? 0 : Math.min(100, Math.max(0, parseFloat(targetObj.publicSpeaking) || 0))
    };

    await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'scores11', docId), numObj);
  };

  const currentList = activeGenderTab === 'Putra' ? finalisPutra : finalisPutri;

  return (
    <div className="space-y-6">
      <div className="bg-white p-5 rounded-2xl border border-slate-200 flex flex-col sm:flex-row justify-between sm:items-center gap-3 shadow-sm">
        <div>
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <Mic className="w-5 h-5 text-red-600" />
            <span>Form Penilaian Babak Speech (11 Besar)</span>
          </h2>
          <p className="text-xs text-slate-500">Skala Nilai tiap kriteria: 0 - 100. Ketik langsung angka nilai pada tabel.</p>
        </div>
        <div className="flex items-center gap-2">
          <button 
            onClick={() => setActiveGenderTab('Putra')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              activeGenderTab === 'Putra' ? 'bg-sky-600 text-white shadow-md' : 'bg-slate-100 text-slate-600'
            }`}
          >
            Peserta Putra ({finalisPutra.length})
          </button>
          <button 
            onClick={() => setActiveGenderTab('Putri')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              activeGenderTab === 'Putri' ? 'bg-pink-600 text-white shadow-md' : 'bg-slate-100 text-slate-600'
            }`}
          >
            Peserta Putri ({finalisPutri.length})
          </button>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-100 text-slate-700 uppercase font-bold border-b border-slate-200">
              <tr>
                <th className="p-3.5 text-center">No</th>
                <th className="p-3.5">Nama Finalis ({activeGenderTab})</th>
                <th className="p-3.5 text-center">Materi Speech (0-100)</th>
                <th className="p-3.5 text-center">Delivery & Artikulasi (0-100)</th>
                <th className="p-3.5 text-center">Public Speaking (0-100)</th>
                <th className="p-3.5 text-center bg-red-50 text-red-700 font-extrabold">Rata-Rata Nilai</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {currentList.length === 0 ? (
                <tr><td colSpan={6} className="p-8 text-center text-xs text-slate-400 italic">Belum ada peserta {activeGenderTab} yang ditambahkan admin.</td></tr>
              ) : (
                currentList.map((f) => {
                  const vals = localInputs[f.id] || { materiSpeech: '', delivery: '', publicSpeaking: '' };
                  const s1 = parseFloat(vals.materiSpeech) || 0;
                  const s2 = parseFloat(vals.delivery) || 0;
                  const s3 = parseFloat(vals.publicSpeaking) || 0;
                  const hasInput = vals.materiSpeech !== '' || vals.delivery !== '' || vals.publicSpeaking !== '';
                  const avg = hasInput ? ((s1 + s2 + s3) / 3).toFixed(2) : '0.00';

                  return (
                    <tr key={f.id} className="hover:bg-slate-50 transition-all">
                      <td className="p-3.5 text-center font-mono font-bold text-red-600 text-sm">{f.no}</td>
                      <td className="p-3.5 font-bold text-slate-900">
                        {f.name} 
                        <div className="text-[10px] text-slate-500 font-normal">{f.prodi}</div>
                      </td>
                      <td className="p-2.5 text-center">
                        <input 
                          type="number" min="0" max="100" step="1"
                          value={vals.materiSpeech}
                          onChange={e => handleChange(f.id, 'materiSpeech', e.target.value)}
                          placeholder="0-100"
                          className="w-24 bg-slate-50 border border-slate-300 text-center rounded-xl p-2 font-mono font-bold text-slate-900 focus:ring-2 focus:ring-red-500 focus:outline-none"
                        />
                      </td>
                      <td className="p-2.5 text-center">
                        <input 
                          type="number" min="0" max="100" step="1"
                          value={vals.delivery}
                          onChange={e => handleChange(f.id, 'delivery', e.target.value)}
                          placeholder="0-100"
                          className="w-24 bg-slate-50 border border-slate-300 text-center rounded-xl p-2 font-mono font-bold text-slate-900 focus:ring-2 focus:ring-red-500 focus:outline-none"
                        />
                      </td>
                      <td className="p-2.5 text-center">
                        <input 
                          type="number" min="0" max="100" step="1"
                          value={vals.publicSpeaking}
                          onChange={e => handleChange(f.id, 'publicSpeaking', e.target.value)}
                          placeholder="0-100"
                          className="w-24 bg-slate-50 border border-slate-300 text-center rounded-xl p-2 font-mono font-bold text-slate-900 focus:ring-2 focus:ring-red-500 focus:outline-none"
                        />
                      </td>
                      <td className="p-3.5 text-center font-mono font-extrabold text-red-600 bg-red-50/50 text-base">{avg}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// --- SUB-KOMPONEN FORM PENILAIAN QnA 6 BESAR (JURI) ---
function FormPenilaianQnA({ juriId, juriName, top3Putra, top3Putri, scores6, db, appId, user, showToast }) {
  const [localInputs, setLocalInputs] = useState({});
  const [activeGenderTab, setActiveGenderTab] = useState('Putra');

  useEffect(() => {
    const formatted = {};
    Object.keys(scores6).forEach(fId => {
      formatted[fId] = {
        kualitasJawaban: scores6[fId]?.kualitasJawaban?.toString() || '',
        kecepatanBerpikir: scores6[fId]?.kecepatanBerpikir?.toString() || '',
        bodyLanguage: scores6[fId]?.bodyLanguage?.toString() || ''
      };
    });
    setLocalInputs(formatted);
  }, [scores6]);

  const handleChange = async (finalisId, field, rawValue) => {
    const newInputs = {
      ...localInputs,
      [finalisId]: {
        ...(localInputs[finalisId] || { kualitasJawaban: '', kecepatanBerpikir: '', bodyLanguage: '' }),
        [field]: rawValue
      }
    };
    setLocalInputs(newInputs);

    if (!user) return;
    const docId = `${juriId}_${finalisId}`;
    const targetObj = newInputs[finalisId];

    const numObj = {
      kualitasJawaban: targetObj.kualitasJawaban === '' ? 0 : Math.min(100, Math.max(0, parseFloat(targetObj.kualitasJawaban) || 0)),
      kecepatanBerpikir: targetObj.kecepatanBerpikir === '' ? 0 : Math.min(100, Math.max(0, parseFloat(targetObj.kecepatanBerpikir) || 0)),
      bodyLanguage: targetObj.bodyLanguage === '' ? 0 : Math.min(100, Math.max(0, parseFloat(targetObj.bodyLanguage) || 0))
    };

    await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'scores6', docId), numObj);
  };

  const currentList = activeGenderTab === 'Putra' ? top3Putra : top3Putri;

  return (
    <div className="space-y-6">
      <div className="bg-white p-5 rounded-2xl border border-slate-200 flex flex-col sm:flex-row justify-between sm:items-center gap-3 shadow-sm">
        <div>
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-teal-600" />
            <span>Form Penilaian Babak Q&A (Top 6 Grand Final)</span>
          </h2>
          <p className="text-xs text-slate-500">Menampilkan 3 Putra & 3 Putri terbaik dari skor Speech babak sebelumnya.</p>
        </div>
        <div className="flex items-center gap-2">
          <button 
            onClick={() => setActiveGenderTab('Putra')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              activeGenderTab === 'Putra' ? 'bg-sky-600 text-white shadow-md' : 'bg-slate-100 text-slate-600'
            }`}
          >
            Top 3 Putra
          </button>
          <button 
            onClick={() => setActiveGenderTab('Putri')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              activeGenderTab === 'Putri' ? 'bg-pink-600 text-white shadow-md' : 'bg-slate-100 text-slate-600'
            }`}
          >
            Top 3 Putri
          </button>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-100 text-slate-700 uppercase font-bold border-b border-slate-200">
              <tr>
                <th className="p-3.5 text-center">No</th>
                <th className="p-3.5">Nama Finalis ({activeGenderTab})</th>
                <th className="p-3.5 text-center">Kualitas Jawaban (0-100)</th>
                <th className="p-3.5 text-center">Kecepatan Berpikir (0-100)</th>
                <th className="p-3.5 text-center">Gestur & Body Language (0-100)</th>
                <th className="p-3.5 text-center bg-teal-50 text-teal-700 font-extrabold">Rata-Rata Q&A</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {currentList.length === 0 ? (
                <tr><td colSpan={6} className="p-8 text-center text-xs text-slate-400 italic">Belum ada peserta {activeGenderTab} yang lolos ke Top 6. (Beri nilai Speech terlebih dahulu).</td></tr>
              ) : (
                currentList.map((f) => {
                  const vals = localInputs[f.id] || { kualitasJawaban: '', kecepatanBerpikir: '', bodyLanguage: '' };
                  const s1 = parseFloat(vals.kualitasJawaban) || 0;
                  const s2 = parseFloat(vals.kecepatanBerpikir) || 0;
                  const s3 = parseFloat(vals.bodyLanguage) || 0;
                  const hasInput = vals.kualitasJawaban !== '' || vals.kecepatanBerpikir !== '' || vals.bodyLanguage !== '';
                  const avg = hasInput ? ((s1 + s2 + s3) / 3).toFixed(2) : '0.00';

                  return (
                    <tr key={f.id} className="hover:bg-slate-50 transition-all">
                      <td className="p-3.5 text-center font-mono font-bold text-teal-600 text-sm">{f.no}</td>
                      <td className="p-3.5 font-bold text-slate-900">
                        {f.name} 
                        <div className="text-[10px] text-slate-500 font-normal">{f.prodi}</div>
                      </td>
                      <td className="p-2.5 text-center">
                        <input 
                          type="number" min="0" max="100" step="1"
                          value={vals.kualitasJawaban}
                          onChange={e => handleChange(f.id, 'kualitasJawaban', e.target.value)}
                          placeholder="0-100"
                          className="w-24 bg-slate-50 border border-slate-300 text-center rounded-xl p-2 font-mono font-bold text-slate-900 focus:ring-2 focus:ring-teal-500 focus:outline-none"
                        />
                      </td>
                      <td className="p-2.5 text-center">
                        <input 
                          type="number" min="0" max="100" step="1"
                          value={vals.kecepatanBerpikir}
                          onChange={e => handleChange(f.id, 'kecepatanBerpikir', e.target.value)}
                          placeholder="0-100"
                          className="w-24 bg-slate-50 border border-slate-300 text-center rounded-xl p-2 font-mono font-bold text-slate-900 focus:ring-2 focus:ring-teal-500 focus:outline-none"
                        />
                      </td>
                      <td className="p-2.5 text-center">
                        <input 
                          type="number" min="0" max="100" step="1"
                          value={vals.bodyLanguage}
                          onChange={e => handleChange(f.id, 'bodyLanguage', e.target.value)}
                          placeholder="0-100"
                          className="w-24 bg-slate-50 border border-slate-300 text-center rounded-xl p-2 font-mono font-bold text-slate-900 focus:ring-2 focus:ring-teal-500 focus:outline-none"
                        />
                      </td>
                      <td className="p-3.5 text-center font-mono font-extrabold text-teal-700 bg-teal-50/50 text-base">{avg}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function TabButton({ id, label, icon: Icon, active, setActive }) {
  const isActive = active === id;
  return (
    <button
      onClick={() => setActive(id)}
      className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center space-x-1.5 whitespace-nowrap transition-all ${
        isActive 
          ? 'bg-red-600 text-white shadow-md' 
          : 'text-slate-600 hover:text-slate-900 hover:bg-white'
      }`}
    >
      <Icon className="w-4 h-4" />
      <span>{label}</span>
    </button>
  );
}

function StatCard({ title, value, sub }) {
  return (
    <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-xl p-3.5 text-white">
      <div className="text-[10px] font-bold text-red-100 uppercase tracking-wider">{title}</div>
      <div className="text-xl font-bold font-mono my-0.5">{value}</div>
      <div className="text-[10px] text-red-100/80">{sub}</div>
    </div>
  );
}