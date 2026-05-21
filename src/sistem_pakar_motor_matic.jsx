import { useState, useMemo, useEffect, useRef } from "react";
import "./motocheck.css";

// ── GANTI URL INI dengan URL Apps Script Google Sheets kamu ──
const SHEET_URL = "https://script.google.com/macros/s/AKfycbxCTe_pDrzVdP4jv0hSuPaMJfVTs9VTPXxZW0Ne_hgXo5Sm-Ob6n3yctQP7NeRvfok/exec";

const KB = {
  "Oli Mesin":               { aman:2000,  ganti:4000,  berat:true,  cat:"Pelumas"  },
  "Oli Gardan":              { aman:4000,  ganti:8000,  berat:false, cat:"Pelumas"  },
  "Busi":                    { aman:6000,  ganti:10000, berat:false, cat:"Pengapian"},
  "Filter Udara":            { aman:10000, ganti:16000, berat:false, cat:"Udara"    },
  "V-Belt (CVT)":            { aman:8000,  ganti:24000, berat:false, cat:"CVT"      },
  "Roller CVT":              { aman:15000, ganti:20000, berat:false, cat:"CVT"      },
  "Kampas Rem":              { aman:8000,  ganti:15000, berat:true,  cat:"Rem"      },
  "Injector & Throttle Body":{ aman:8000,  ganti:10000, berat:false, cat:"Injeksi"  },
  "Kampas Ganda (CVT)":      { aman:20000, ganti:25000, berat:false, cat:"CVT"      },
};

const AKSI = {
  "Oli Mesin":               { p:"Segera rencanakan ganti oli mesin.",                 w:"Oli mesin WAJIB diganti sekarang!" },
  "Oli Gardan":              { p:"Jadwalkan ganti oli gardan.",                         w:"Oli gardan WAJIB diganti!" },
  "Busi":                    { p:"Cek kondisi busi, pertimbangkan penggantian.",        w:"Busi WAJIB diganti! Risiko mogok." },
  "Filter Udara":            { p:"Bersihkan atau periksa filter udara.",               w:"Filter udara WAJIB diganti!" },
  "V-Belt (CVT)":            { p:"Cek V-Belt, waspadai retakan.",                      w:"V-Belt WAJIB diganti! Risiko putus di jalan." },
  "Roller CVT":              { p:"Periksa Roller CVT, cek apakah sudah peyang.",       w:"Roller CVT aus! Ganti segera." },
  "Kampas Rem":              { p:"Cek ketebalan kampas rem.",                          w:"Kampas rem WAJIB diganti! Risiko rem blong." },
  "Injector & Throttle Body":{ p:"Jadwalkan pembersihan injektor & throttle body.",    w:"Injektor & Throttle Body WAJIB dibersihkan!" },
  "Kampas Ganda (CVT)":      { p:"Perhatikan gejala gredek saat gas awal.",            w:"Kampas Ganda aus! Ganti segera." },
};

const MOTORS = [
  "Honda Beat","Honda Vario 125","Honda Vario 150","Honda Scoopy","Honda Genio","Honda ADV 160",
  "Yamaha NMAX","Yamaha Mio","Yamaha Filano","Yamaha Aerox","Lainnya",
];

function infer(nama, km, kondisi) {
  const kb = KB[nama];
  let aman = kb.aman, ganti = kb.ganti;
  if (kondisi === "Berat" && kb.berat) { aman -= 1000; ganti -= 1000; }
  const pct = km >= ganti ? 100 : km >= aman
    ? 70 + Math.round(((km-aman)/(ganti-aman))*28)
    : Math.round((km/aman)*68);
  if (km < aman)  return { status:"AMAN",       aksi:"Tidak perlu tindakan. Motor aman digunakan.", sisa:ganti-km, pct };
  if (km < ganti) return { status:"PERINGATAN", aksi:AKSI[nama].p, sisa:ganti-km, pct };
  return             { status:"WAJIB GANTI", aksi:AKSI[nama].w, sisa:0, pct:100 };
}

function calcKm(metode, odo, odoServis, tgl, kmH) {
  if (metode==="odo")            return Math.max(0, odo-(Number(odoServis)||0));
  if (metode==="tanggal" && tgl) return Math.max(0, Math.floor((Date.now()-new Date(tgl))/86400000)*kmH);
  return odo;
}

function prediksi(sisa, kmH) {
  if (!kmH || sisa<=0) return null;
  const hari = Math.round(sisa/kmH);
  const d = new Date(); d.setDate(d.getDate()+hari);
  return { hari, tgl:d.toLocaleDateString("id-ID",{day:"numeric",month:"short",year:"numeric"}) };
}

// ── ILLUSTRATIVE SVG ICONS (colored, filled-style) ──
function IllusIcon({ nama, color, size=56 }) {
  const c = color;
  const s = size;
  const icons = {
    "Oli Mesin": (
      <svg width={s} height={s} viewBox="0 0 56 56" fill="none">
        <ellipse cx="28" cy="42" rx="16" ry="6" fill={c} opacity=".15"/>
        <path d="M18 14h14l6 8v16a4 4 0 01-4 4H22a4 4 0 01-4-4V14z" fill={c} opacity=".2"/>
        <path d="M20 14h12l5 7v15a3 3 0 01-3 3H23a3 3 0 01-3-3V14z" fill={c}/>
        <path d="M20 14h12l2 3H20v-3z" fill="white" opacity=".3"/>
        <circle cx="38" cy="36" r="5" fill={c} opacity=".9"/>
        <path d="M38 33v3l2 2" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
        <path d="M26 30c0 3 4 3 4 6" stroke="white" strokeWidth="1.5" strokeLinecap="round" opacity=".7"/>
      </svg>
    ),
    "Oli Gardan": (
      <svg width={s} height={s} viewBox="0 0 56 56" fill="none">
        <rect x="10" y="18" width="36" height="24" rx="4" fill={c} opacity=".2"/>
        <rect x="12" y="20" width="32" height="20" rx="3" fill={c}/>
        <rect x="12" y="20" width="32" height="7" fill="white" opacity=".2"/>
        <path d="M16 10h6l2 8H14l2-8z" fill={c} opacity=".8"/>
        <circle cx="18" cy="34" r="3" fill="white" opacity=".4"/>
        <circle cx="38" cy="34" r="3" fill="white" opacity=".4"/>
        <rect x="22" y="28" width="12" height="2" rx="1" fill="white" opacity=".3"/>
      </svg>
    ),
    "Busi": (
      <svg width={s} height={s} viewBox="0 0 56 56" fill="none">
        <rect x="22" y="8" width="12" height="18" rx="3" fill={c} opacity=".3"/>
        <rect x="20" y="24" width="16" height="10" rx="2" fill={c}/>
        <rect x="24" y="34" width="8" height="12" rx="2" fill={c} opacity=".7"/>
        <path d="M30 18l-6 10h5l-5 10" stroke={c} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" opacity=".9" fill="none"/>
        <circle cx="28" cy="46" r="2" fill={c}/>
      </svg>
    ),
    "Filter Udara": (
      <svg width={s} height={s} viewBox="0 0 56 56" fill="none">
        <rect x="10" y="16" width="36" height="24" rx="6" fill={c} opacity=".15"/>
        <rect x="12" y="18" width="32" height="20" rx="5" fill={c} opacity=".3"/>
        <path d="M14 24h10M14 28h14M14 32h10" stroke={c} strokeWidth="2.5" strokeLinecap="round"/>
        <path d="M32 20c4 2 6 5 6 8s-2 6-6 8" stroke={c} strokeWidth="2" strokeLinecap="round" fill="none" opacity=".6"/>
        <path d="M36 22c3 2 4 4 4 6s-1 4-4 6" stroke={c} strokeWidth="1.5" strokeLinecap="round" fill="none" opacity=".4"/>
      </svg>
    ),
    "V-Belt (CVT)": (
      <svg width={s} height={s} viewBox="0 0 56 56" fill="none">
        <circle cx="16" cy="28" r="10" fill={c} opacity=".2"/>
        <circle cx="16" cy="28" r="10" stroke={c} strokeWidth="3" fill="none"/>
        <circle cx="16" cy="28" r="4" fill={c}/>
        <circle cx="40" cy="28" r="7" fill={c} opacity=".2"/>
        <circle cx="40" cy="28" r="7" stroke={c} strokeWidth="3" fill="none"/>
        <circle cx="40" cy="28" r="3" fill={c}/>
        <path d="M16 19h24" stroke={c} strokeWidth="2.5"/>
        <path d="M16 37h24" stroke={c} strokeWidth="2.5"/>
      </svg>
    ),
    "Roller CVT": (
      <svg width={s} height={s} viewBox="0 0 56 56" fill="none">
        <circle cx="20" cy="24" r="8" fill={c} opacity=".2"/>
        <circle cx="20" cy="24" r="8" stroke={c} strokeWidth="2.5" fill="none"/>
        <circle cx="20" cy="24" r="3" fill={c}/>
        <circle cx="38" cy="34" r="8" fill={c} opacity=".2"/>
        <circle cx="38" cy="34" r="8" stroke={c} strokeWidth="2.5" fill="none"/>
        <circle cx="38" cy="34" r="3" fill={c}/>
        <path d="M44 16a14 14 0 11-6 24" stroke={c} strokeWidth="2" fill="none" strokeLinecap="round"/>
        <path d="M44 16l-4-4v4h4z" fill={c}/>
      </svg>
    ),
    "Kampas Rem": (
      <svg width={s} height={s} viewBox="0 0 56 56" fill="none">
        <circle cx="28" cy="28" r="18" fill={c} opacity=".1"/>
        <circle cx="28" cy="28" r="18" stroke={c} strokeWidth="3" fill="none"/>
        <circle cx="28" cy="28" r="10" fill={c} opacity=".2"/>
        <circle cx="28" cy="28" r="10" stroke={c} strokeWidth="2" fill="none"/>
        <circle cx="28" cy="28" r="3" fill={c}/>
        <path d="M28 10v6M28 40v6M10 28h6M40 28h6" stroke={c} strokeWidth="2" strokeLinecap="round" opacity=".5"/>
      </svg>
    ),
    "Injector & Throttle Body": (
      <svg width={s} height={s} viewBox="0 0 56 56" fill="none">
        <rect x="18" y="8" width="20" height="12" rx="3" fill={c} opacity=".3"/>
        <rect x="20" y="8" width="16" height="10" rx="2" fill={c}/>
        <rect x="22" y="18" width="12" height="16" rx="2" fill={c} opacity=".7"/>
        <path d="M26 34l-4 6h12l-4-6H26z" fill={c} opacity=".5"/>
        <circle cx="28" cy="42" r="2.5" fill={c}/>
        <path d="M24 12h8M24 22h8" stroke="white" strokeWidth="1.5" strokeLinecap="round" opacity=".5"/>
      </svg>
    ),
    "Kampas Ganda (CVT)": (
      <svg width={s} height={s} viewBox="0 0 56 56" fill="none">
        <circle cx="28" cy="28" r="16" fill={c} opacity=".1"/>
        <circle cx="28" cy="28" r="16" stroke={c} strokeWidth="2.5" fill="none"/>
        <circle cx="28" cy="28" r="8" fill={c} opacity=".2"/>
        <circle cx="28" cy="28" r="8" stroke={c} strokeWidth="2" fill="none"/>
        <circle cx="28" cy="28" r="3" fill={c}/>
        <path d="M28 12v4M28 40v4M12 28h4M40 28h4M16.7 16.7l2.8 2.8M36.5 36.5l2.8 2.8M16.7 39.3l2.8-2.8M36.5 19.5l2.8-2.8" stroke={c} strokeWidth="2" strokeLinecap="round"/>
      </svg>
    ),
  };
  return icons[nama] || null;
}

// ── SMALL STATUS ICON ──
function StatusIco({ status, size=20 }) {
  if (status==="AMAN")
    return <svg width={size} height={size} viewBox="0 0 20 20" fill="none"><circle cx="10" cy="10" r="9" fill="#16a34a"/><path d="M6 10l3 3 5-5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>;
  if (status==="PERINGATAN")
    return <svg width={size} height={size} viewBox="0 0 20 20" fill="none"><path d="M10 2L2 17h16L10 2z" fill="#f97316"/><path d="M10 8v4M10 14v1" stroke="white" strokeWidth="2" strokeLinecap="round"/></svg>;
  return <svg width={size} height={size} viewBox="0 0 20 20" fill="none"><circle cx="10" cy="10" r="9" fill="#dc2626"/><path d="M7 7l6 6M13 7l-6 6" stroke="white" strokeWidth="2" strokeLinecap="round"/></svg>;
}

// ── LOGO ──
function LogoIco() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" width="22" height="22">
    <path d="M2 17h20M5 17l1-5h12l1 5M7 12l1-6h8l1 6"/><circle cx="7.5" cy="19" r="1.5"/><circle cx="16.5" cy="19" r="1.5"/>
  </svg>;
}
function DlIco() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" width="16" height="16">
    <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
  </svg>;
}
function ChkIco() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" width="12" height="12"><polyline points="20 6 9 17 4 12"/></svg>;
}

// ── COMP CARD (hasil) ──
function CompCard({ data, open, onToggle }) {
  const color = data.status==="AMAN" ? "#16a34a" : data.status==="PERINGATAN" ? "#f97316" : "#dc2626";
  const pred  = data.pred;
  return (
    <div className={`comp-card${open?" open":""}`} onClick={onToggle}>
      <div className="comp-card-hd">
        <StatusIco status={data.status}/>
        <span className="comp-card-name">{data.nama}</span>
      </div>
      <div className="comp-illus-wrap">
        <IllusIcon nama={data.nama} color={color}/>
      </div>
      <div className="pbar-wrap" style={{marginBottom:8}}>
        <div className="pbar-fill" style={{width:`${data.pct}%`,background:color}}/>
      </div>
      {data.status==="WAJIB GANTI"
        ? <div className="comp-km-left" style={{color}}>Harus diganti!</div>
        : <div className="comp-km-left" style={{color}}>{data.sisa.toLocaleString("id-ID")} km sisa</div>
      }
      {pred && <div className="comp-est">Est. {pred.tgl}</div>}
      {open && (
        <div className="comp-expand">
          <div style={{marginBottom:10}}>{data.aksi}</div>
          <div className="comp-expand-grid">
            <div className="mini-info">
              <div className="mini-info-label">PEMAKAIAN</div>
              <div className="mini-info-val">{data.km.toLocaleString("id-ID")} km</div>
            </div>
            {pred && <div className="mini-info">
              <div className="mini-info-label">SISA HARI</div>
              <div className="mini-info-val" style={{color}}>{pred.hari} hari</div>
            </div>}
          </div>
        </div>
      )}
    </div>
  );
}

// ── FORM GROUP ──
function FG({ label, hint, children }) {
  return (
    <div className="fg">
      <label>{label}</label>
      {/* Selalu render small agar tinggi label area seragam di grid */}
      <small style={{ display:"block", minHeight:"14px" }}>{hint || ""}</small>
      {children}
    </div>
  );
}

// ── BANNER ──
function Banner({ hasil }) {
  const wajib = hasil.filter(h=>h.status==="WAJIB GANTI");
  const warn  = hasil.filter(h=>h.status==="PERINGATAN");
  if (wajib.length) return (
    <div className="banner crit">
      <div className="banner-head">SEGERA DITANGANI · {wajib.length} KOMPONEN</div>
      {wajib.map((h, i) => (
        <div className="banner-body" key={h.nama} style={{
          borderTop: i > 0 ? "1px solid #fca5a5" : "none",
          borderRadius: i === wajib.length - 1 ? "0 0 var(--r-lg) var(--r-lg)" : "0",
        }}>
          <StatusIco status="WAJIB GANTI"/>
          <span><strong>{h.nama}</strong> — {h.aksi}</span>
        </div>
      ))}
    </div>
  );
  if (warn.length) return (
    <div className="banner warn">
      <div className="banner-head">MODERATE PRIORITY · {warn.length} KOMPONEN</div>
      {warn.map((h, i) => (
        <div className="banner-body" key={h.nama} style={{
          borderTop: i > 0 ? "1px solid #fed7aa" : "none",
          borderRadius: i === warn.length - 1 ? "0 0 var(--r-lg) var(--r-lg)" : "0",
        }}>
          <StatusIco status="PERINGATAN"/>
          <span><strong>{h.nama}</strong> — perlu perhatian</span>
        </div>
      ))}
    </div>
  );
  return (
    <div className="banner good">
      <div className="banner-head">ALL GOOD</div>
      <div className="banner-body">
        <StatusIco status="AMAN"/>
        <span>Semua komponen dalam kondisi aman</span>
      </div>
    </div>
  );
}

// ── MAIN APP ──
export default function App() {
  const [step,     setStep]     = useState(0);
  const [nama,     setNama]     = useState("");
  const [motor,    setMotor]    = useState("Honda Beat");
  const [tahun,    setTahun]    = useState("");
  const [odo,      setOdo]      = useState(5000);
  const [kmH,      setKmH]      = useState(15);
  const [kondisi,  setKondisi]  = useState("Normal");
  const [expanded, setExpanded] = useState(null);
  const [submitStatus, setSubmitStatus] = useState(null); // null | 'sending' | 'ok' | 'err'
  const submitted = useRef(false);

  const initR = () => Object.fromEntries(Object.keys(KB).map(k=>[k,{metode:"odo",odoServis:"",tgl:""}]));
  const [riwayat, setRiwayat]   = useState(initR);

  function setR(k, f, v) { setRiwayat(p=>({...p,[k]:{...p[k],[f]:v}})); }
  function reset() { setStep(0);setNama("");setMotor("Honda Beat");setTahun("");setOdo(5000);setKmH(15);setKondisi("Normal");setExpanded(null);setRiwayat(initR());submitted.current=false;setSubmitStatus(null); }

  const hasil = useMemo(()=>{
    if(step<2) return [];
    return Object.keys(KB).map(n=>{
      const r=riwayat[n], km=calcKm(r.metode,odo,r.odoServis,r.tgl,kmH), inf=infer(n,km,kondisi);
      return {nama:n,km,...inf,pred:prediksi(inf.sisa,kmH)};
    }).sort((a,b)=>{const o={"WAJIB GANTI":0,PERINGATAN:1,AMAN:2};return o[a.status]-o[b.status];});
  },[step,riwayat,odo,kmH,kondisi]);

  const ring = useMemo(()=>({
    aman:      hasil.filter(h=>h.status==="AMAN").length,
    peringatan:hasil.filter(h=>h.status==="PERINGATAN").length,
    wajib:     hasil.filter(h=>h.status==="WAJIB GANTI").length,
  }),[hasil]);

  // ── AUTO-SUBMIT KE GOOGLE SHEETS saat Step 3 pertama kali tampil ──
  useEffect(() => {
    if (step === 2 && hasil.length > 0 && !submitted.current && SHEET_URL !== "GANTI_DENGAN_URL_APPS_SCRIPT_KAMU") {
      submitted.current = true;
      setSubmitStatus("sending");
      const ts = new Date().toLocaleString("id-ID");
      const health = Math.round((hasil.filter(h=>h.status==="AMAN").length / hasil.length) * 100);
      const rows = hasil.map(h => {
        const r = riwayat[h.nama];
        return [
          ts, nama||"—", motor, tahun||"—", odo, kmH, kondisi,
          h.nama, KB[h.nama].cat, r.metode, h.km, h.status,
          h.aksi, h.sisa, h.pred?.hari||"", h.pred?.tgl||"", health
        ];
      });
      fetch(SHEET_URL, {
        method: "POST",
        mode: "no-cors",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows }),
      })
        .then(() => setSubmitStatus("ok"))
        .catch(() => setSubmitStatus("err"));
    }
  }, [step, hasil]);

  function downloadCSV() {
    const ts   = new Date().toLocaleString("id-ID");
    const health = hasil.length ? Math.round((ring.aman/hasil.length)*100) : 0;
    const hdr  = "Timestamp,Nama,Motor,Tahun,Odometer (km),KM Harian,Kondisi,Komponen,Kategori,Metode Input,KM Pemakaian,Status,Aksi,Sisa KM,Prediksi Hari,Estimasi Tanggal,Health Score (%)";
    const rows = hasil.map(h=>{
      const r=riwayat[h.nama];
      return `"${ts}","${nama||"—"}","${motor}","${tahun||"—"}",${odo},${kmH},"${kondisi}","${h.nama}","${KB[h.nama].cat}","${r.metode}",${h.km},"${h.status}","${h.aksi}",${h.sisa},"${h.pred?.hari||""}","${h.pred?.tgl||""}",${health}`;
    });
    const blob = new Blob(["\uFEFF"+[hdr,...rows].join("\n")],{type:"text/csv;charset=utf-8;"});
    const a=document.createElement("a"); a.href=URL.createObjectURL(blob);
    a.download=`motocheck_${(nama||"pengendara").replace(/\s+/g,"_")}_${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
  }

  const STEPS = ["Info Motor","Riwayat Servis","Hasil Diagnosis"];

  return (
    <div className="app-wrap">
      <div className="app-inner">

        {/* HEADER */}
        <div className="app-header">
          <div className="app-brand">
            <div className="brand-logo"><LogoIco/></div>
            <div>
              <div className="brand-name">MotoCheck</div>
              <div className="brand-sub">Sistem Pakar Motor Matic</div>
            </div>
          </div>
        </div>

        {/* STEPS */}
        <div className="steps">
          {STEPS.map((s,i)=>{
            const cls = i<step?"done":i===step?"active":"idle";
            return (
              <div key={s} className={`step-pill ${cls}`}>
                <div className="step-num">{i<step?<ChkIco/>:i+1}</div>
                <span style={{fontSize:11}}>{s}</span>
              </div>
            );
          })}
        </div>

        {/* STEP 1 */}
        {step===0 && (
          <div className="card">
            <div className="section-title">Data Kendaraan</div>
            <div className="form-stack">
              {/* Grid 4 field sejajar */}
              <div className="form-grid-4">
                <FG label="Nama Pengendara" hint="Opsional">
                  <input className="inp" value={nama} onChange={e=>setNama(e.target.value)} placeholder="Nama pengendara..."/>
                </FG>
                <FG label="Jenis Motor">
                  <select className="inp" value={motor} onChange={e=>setMotor(e.target.value)}>
                    {MOTORS.map(m=><option key={m}>{m}</option>)}
                  </select>
                </FG>
                <FG label="Tahun Motor" hint="Opsional">
                  <input className="inp" type="number" value={tahun} onChange={e=>setTahun(e.target.value)} placeholder="Contoh: 2022" min="2000" max="2030"/>
                </FG>
                <FG label="Odometer Saat Ini (km)">
                  <input className="inp" type="number" value={odo} onChange={e=>setOdo(Number(e.target.value))} min="0"/>
                </FG>
              </div>
              <FG label="Rata-rata KM Harian">
                <input className="inp" type="number" value={kmH} onChange={e=>setKmH(Number(e.target.value))} min="1"/>
              </FG>
              <div className="fg">
                <label>Kondisi Penggunaan</label>
                <div className="cond-grid">
                  {[{v:"Normal",d:"Jalanan rata & lancar, jarak harian < 30 km"},{v:"Berat",d:"Macet / tanjakan / jarak harian ≥ 30 km"}].map(({v,d})=>(
                    <button key={v} className={`cond-btn${kondisi===v?" sel":""}`} onClick={()=>setKondisi(v)}>
                      <div className="cond-title">{v}</div>
                      <div className="cond-desc">{d}</div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="btn-row"><button className="btn-p" onClick={()=>setStep(1)}>Lanjut →</button></div>
          </div>
        )}

        {/* STEP 2 */}
        {step===1 && (
          <>
            {Object.entries(KB).map(([k,kb])=>{
              const r=riwayat[k];
              return (
                <div key={k} className="komp-card">
                  <div className="komp-hd">
                    <div className="komp-ico"><IllusIcon nama={k} color="#64748b" size={28}/></div>
                    <div>
                      <div className="komp-name">{k}</div>
                      <div className="komp-sub">{kb.cat} · Ganti @ {kb.ganti.toLocaleString("id-ID")} km</div>
                    </div>
                  </div>
                  <div className="met-row">
                    {[["odo","Via Odometer"],["tanggal","Via Tanggal"],["tidak_tahu","Tidak Tahu"]].map(([v,l])=>(
                      <button key={v} className={`met-btn${r.metode===v?" sel":""}`} onClick={()=>setR(k,"metode",v)}>{l}</button>
                    ))}
                  </div>
                  {r.metode==="odo"      && <input className="inp" type="number" placeholder="Odometer saat servis terakhir (km)" value={r.odoServis} onChange={e=>setR(k,"odoServis",e.target.value)}/>}
                  {r.metode==="tanggal"  && <input className="inp" type="date" value={r.tgl} onChange={e=>setR(k,"tgl",e.target.value)}/>}
                  {r.metode==="tidak_tahu" && <div className="warn-box">Sistem mengasumsikan pemakaian penuh: <strong>{odo.toLocaleString("id-ID")} km</strong></div>}
                </div>
              );
            })}
            <div className="btn-row">
              <button className="btn-s" onClick={()=>setStep(0)}>← Kembali</button>
              <button className="btn-p" onClick={()=>setStep(2)}>Proses Diagnosis →</button>
            </div>
          </>
        )}

        {/* STEP 3 */}
        {step===2 && (
          <>
            {/* Odometer Card */}
            <div className="odo-card">
              <div className="odo-top">
                <div className="odo-motor">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#334155" strokeWidth="2" strokeLinecap="round"><path d="M2 17h20M5 17l1-5h12l1 5M7 12l1-6h8l1 6"/><circle cx="7.5" cy="19" r="1.5"/><circle cx="16.5" cy="19" r="1.5"/></svg>
                  {motor}{tahun?` ${tahun}`:""} {nama?`· ${nama}`:""}
                </div>
              </div>
              <div className="odo-tags">
                <span className={`odo-tag tag-cond${kondisi==="Normal"?" normal":""}`}>{kondisi}</span>
                <span className="odo-tag tag-km">{kmH} km/hari</span>
              </div>
              <div className="odo-val">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#334155" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><path d="M12 8v4l3 3"/></svg>
                {odo.toLocaleString("id-ID")} <span className="odo-unit">km</span>
              </div>
            </div>

            {/* Banner */}
            <Banner hasil={hasil}/>

            {/* Summary Pills */}
            <div className="summ-row">
              <div className="summ-pill"><div className="summ-val" style={{color:"#16a34a"}}>{ring.aman}</div><div className="summ-lbl">AMAN</div></div>
              <div className="summ-pill"><div className="summ-val" style={{color:"#f97316"}}>{ring.peringatan}</div><div className="summ-lbl">PERIKSA</div></div>
              <div className="summ-pill"><div className="summ-val" style={{color:"#dc2626"}}>{ring.wajib}</div><div className="summ-lbl">WAJIB GANTI</div></div>
            </div>

            {/* Comp Grid */}
            <div className="comp-section-hd">
              <span className="comp-section-title">Komponen</span>
              <span style={{fontSize:12,color:"#64748b",fontWeight:600}}>{hasil.length} komponen</span>
            </div>
            <div className="comp-grid">
              {hasil.map(h=>(
                <CompCard key={h.nama} data={h}
                  open={expanded===h.nama}
                  onToggle={()=>setExpanded(expanded===h.nama?null:h.nama)}/>
              ))}
            </div>

            {/* Submit Status */}
            {submitStatus && (
              <div className={`submit-status ${submitStatus}`}>
                {submitStatus==="sending" && "⏳ Mengirim data ke server..."}
                {submitStatus==="ok"      && "✅ Data berhasil dikirim ke Google Sheets!"}
                {submitStatus==="err"     && "⚠️ Gagal kirim otomatis. Gunakan Download CSV."}
              </div>
            )}

            <div className="btn-row">
              <button className="btn-s" onClick={reset}>↺ Diagnosis Ulang</button>
              <button className="btn-g" onClick={downloadCSV}><DlIco/> Download CSV</button>
            </div>
          </>
        )}

      </div>
    </div>
  );
}
