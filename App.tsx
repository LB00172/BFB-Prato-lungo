import React, { useState, useEffect } from 'react';

// Tipi di dati per la gestione dei giorni di campo
interface DayData {
  note: string;
  adultsTotal: string; // string per gestire i campi vuoti nei form
  kidsTotal: string;
  adultsLunch: string;
  adultsDinner: string;
  expenseFood: string;
  expenseDrinks: string;
  expenseAccessory: string;
}

type CampData = Record<string, DayData>;

const initialDayState = (): DayData => ({
  note: '',
  adultsTotal: '',
  kidsTotal: '',
  adultsLunch: '',
  adultsDinner: '',
  expenseFood: '',
  expenseDrinks: '',
  expenseAccessory: '',
});

export default function App() {
  const [showSplash, setShowSplash] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState<'calendario' | 'partecipanti' | 'spesa'>('calendario');
  const [currentDate, setCurrentDate] = useState<Date>(new Date('2026-08-11')); // Inizio campo
  const [selectedDateStr, setSelectedDateStr] = useState<string>('2026-08-11');
  const [campData, setCampData] = useState<CampData>(() => {
    const saved = localStorage.getItem('cambusa_camp_data');
    return saved ? JSON.parse(saved) : {};
  });

  // Timer per lo Splash Screen
  useEffect(() => {
    const timer = setTimeout(() => {
      setShowSplash(false);
    }, 3500); // 3.5 secondi per caricare la pagina
    return () => clearTimeout(timer);
  }, []);

  // Salvataggio automatico offline
  useEffect(() => {
    localStorage.setItem('cambusa_camp_data', JSON.stringify(campData));
  }, [campData]);

  const getDayData = (dateStr: string): DayData => {
    return campData[dateStr] || initialDayState();
  };

  const updateDayData = (dateStr: string, field: keyof DayData, value: string) => {
    setCampData((prev) => ({
      ...prev,
      [dateStr]: {
        ...(prev[dateStr] || initialDayState()),
        [field]: value,
      },
    }));
  };

  // Navigazione settimane
  const changeWeek = (days: number) => {
    const newDate = new Date(currentDate);
    newDate.setDate(newDate.getDate() + days);
    setCurrentDate(newDate);
    setSelectedDateStr(newDate.toISOString().split('T')[0]);
  };

  // Calcoli economici e presenze
  const calculateTotals = () => {
    let totalFood = 0;
    let totalDrinks = 0;
    let totalAccessory = 0;
    const dailyBreakdown: Record<string, { totalCost: number; costPerAdult: number }> = {};

    Object.entries(campData).forEach(([date, data]) => {
      const food = parseFloat(data.expenseFood) || 0;
      const drinks = parseFloat(data.expenseDrinks) || 0;
      const acc = parseFloat(data.expenseAccessory) || 0;

      totalFood += food;
      totalDrinks += drinks;
      totalAccessory += acc;

      const dayTotal = food + drinks + acc;

      // Calcoliamo i partecipanti attivi ai pasti (solo gli adulti pagano!)
      const adultsLunch = parseInt(data.adultsLunch) || 0;
      const adultsDinner = parseInt(data.adultsDinner) || 0;
      
      // Se non ci sono specifiche sui pasti, usiamo il totale degli adulti della giornata
      const totalPayingAdults = adultsLunch + adultsDinner || parseInt(data.adultsTotal) || 0;

      dailyBreakdown[date] = {
        totalCost: dayTotal,
        costPerAdult: totalPayingAdults > 0 ? dayTotal / totalPayingAdults : 0,
      };
    });

    const overallTotal = totalFood + totalDrinks + totalAccessory;

    return {
      totalFood,
      totalDrinks,
      totalAccessory,
      overallTotal,
      dailyBreakdown,
    };
  };

  const totals = calculateTotals();

  // Genera i giorni della settimana corrente da visualizzare
  const getDaysOfWeek = (start: Date) => {
    const days = [];
    const temp = new Date(start);
    // Trova il lunedì della settimana corrente
    const day = temp.getDay();
    const diff = temp.getDate() - day + (day === 0 ? -6 : 1);
    temp.setDate(diff);

    for (let i = 0; i < 7; i++) {
      days.push(new Date(temp));
      temp.setDate(temp.getDate() + 1);
    }
    return days;
  };

  const weekDays = getDaysOfWeek(currentDate);

  if (showSplash) {
    return (
      <div className="fixed inset-0 bg-[#2D392C] flex flex-col items-center justify-center text-[#F0F4F1] z-50 transition-opacity duration-1000">
        <div className="w-40 h-40 mb-6 border-4 border-[#8F9E8B] rounded-full flex items-center justify-center overflow-hidden bg-[#2D392C]">
          {/* Sostituisci questo SVG con la tua immagine logo in base64 o link diretto quando la avrai */}
          <svg className="w-24 h-24 text-[#8F9E8B]" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M19 11.08V8a1 1 0 00-.07-.3M18 8a2 2 0 11-4 0 1 1 0 01-2 0 2 2 0 10-4 0M2 8h16M2 8a2 2 0 114 0M2 8V20a1 1 0 001 1h14a1 1 0 001-1V8M11 12.4V12m0 4v.1m0-12.2V3a1 1 0 00-1-1H5a1 1 0 00-1 1v3.4" />
          </svg>
        </div>
        <h1 className="font-rustic text-3xl tracking-widest text-[#8F9E8B]">CAMBUSA APP</h1>
        <p className="mt-2 text-xs uppercase tracking-widest opacity-60">Caricamento inventario...</p>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto min-h-screen flex flex-col bg-[#F0F4F1] border-x border-[#8F9E8B]/30 shadow-2xl pb-24">
      {/* Header fisso */}
      <header className="bg-[#2D392C] text-[#F0F4F1] p-4 text-center border-b-4 border-[#5C4A3C]">
        <h1 className="font-rustic text-2xl tracking-wide">PERETO 2026</h1>
        <p className="text-xs uppercase tracking-wider text-[#8F9E8B]">Campo Base Freecamping</p>
      </header>

      {/* Area Contenuto */}
      <main className="flex-grow p-4">
        
        {/* TABS PRINCIPALI */}
        <div className="grid grid-cols-3 gap-2 mb-6">
          {(['calendario', 'partecipanti', 'spesa'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`py-3 px-1 rounded text-xs font-bold uppercase tracking-wider border-b-4 transition-all ${
                activeTab === tab
                  ? 'bg-[#2D392C] text-[#F0F4F1] border-[#5C4A3C]'
                  : 'bg-white text-[#2D392C] border-gray-300 hover:bg-[#E2EAE4]'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* CONTENUTO SCHEDA: CALENDARIO */}
        {activeTab === 'calendario' && (
          <div className="space-y-4">
            <div className="flex justify-between items-center bg-white p-3 rounded-lg border border-[#8F9E8B]/30 shadow-sm">
              <button onClick={() => changeWeek(-7)} className="p-2 font-bold bg-[#8F9E8B]/20 rounded hover:bg-[#8F9E8B]/40">&larr;</button>
              <span className="font-bold text-sm text-[#2D392C] uppercase font-rustic">
                Settimana di Campo
              </span>
              <button onClick={() => changeWeek(7)} className="p-2 font-bold bg-[#8F9E8B]/20 rounded hover:bg-[#8F9E8B]/40">&rarr;</button>
            </div>

            <div className="grid grid-cols-7 gap-1">
              {weekDays.map((d) => {
                const dateStr = d.toISOString().split('T')[0];
                const isSelected = dateStr === selectedDateStr;
                const isCampPeriod = dateStr >= '2026-08-11' && dateStr <= '2026-08-16';
                const label = d.toLocaleDateString('it-IT', { weekday: 'short' });
                const dayNum = d.getDate();

                return (
                  <button
                    key={dateStr}
                    onClick={() => setSelectedDateStr(dateStr)}
                    className={`p-2 flex flex-col items-center rounded-lg border transition-all ${
                      isSelected
                        ? 'bg-[#5C4A3C] text-white border-[#5C4A3C]'
                        : isCampPeriod
                        ? 'bg-[#2D392C]/10 text-[#2D392C] border-[#2D392C]'
                        : 'bg-white text-gray-400 border-gray-200'
                    }`}
                  >
                    <span className="text-[10px] uppercase font-bold">{label}</span>
                    <span className="text-lg font-bold font-rustic">{dayNum}</span>
                    {isCampPeriod && <span className="w-1.5 h-1.5 bg-[#D97706] rounded-full mt-0.5"></span>}
                  </button>
                );
              })}
            </div>

            {/* Note del giorno selezionato */}
            <div className="bg-white p-4 rounded-lg border-2 border-[#2D392C]/20 shadow-sm space-y-3">
              <h3 className="font-rustic text-lg border-b border-dashed border-[#8F9E8B] pb-1">
                Note del {new Date(selectedDateStr).toLocaleDateString('it-IT', { day: 'numeric', month: 'long' })}
              </h3>
              <textarea
                value={getDayData(selectedDateStr).note}
                onChange={(e) => updateDayData(selectedDateStr, 'note', e.target.value)}
                placeholder="Inserisci note sul menu, meteo o legna per oggi..."
                className="w-full h-32 p-3 bg-[#F0F4F1]/50 border border-[#8F9E8B]/30 rounded-lg text-sm focus:outline-none focus:border-[#2D392C] resize-none"
              />
            </div>
          </div>
        )}

        {/* CONTENUTO SCHEDA: PARTECIPANTI */}
        {activeTab === 'partecipanti' && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 bg-white p-3 rounded-lg border border-[#8F9E8B]/30">
              <span className="text-xs uppercase font-bold text-[#5C4A3C]">Seleziona Giorno:</span>
              <input
                type="date"
                value={selectedDateStr}
                onChange={(e) => setSelectedDateStr(e.target.value)}
                className="bg-[#F0F4F1] border border-[#8F9E8B]/30 px-2 py-1 rounded text-sm focus:outline-none font-bold"
              />
            </div>

            <div className="bg-white p-4 rounded-lg border-2 border-[#2D392C]/20 shadow-sm space-y-4">
              <h3 className="font-rustic text-lg border-b border-[#8F9E8B]/40 pb-2 text-[#2D392C]">
                Presenze del {new Date(selectedDateStr).toLocaleDateString('it-IT', { day: 'numeric', month: 'long' })}
              </h3>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] uppercase font-bold text-gray-500 mb-1">Adulti Totali</label>
                  <input
                    type="number"
                    value={getDayData(selectedDateStr).adultsTotal}
                    onChange={(e) => updateDayData(selectedDateStr, 'adultsTotal', e.target.value)}
                    placeholder="25"
                    className="w-full p-2.5 bg-[#F0F4F1]/50 border border-[#8F9E8B]/30 rounded text-center font-bold"
                  />
                </div>
                <div>
                  <label className="block text-[11px] uppercase font-bold text-gray-500 mb-1">Bambini (Gratis)</label>
                  <input
                    type="number"
                    value={getDayData(selectedDateStr).kidsTotal}
                    onChange={(e) => updateDayData(selectedDateStr, 'kidsTotal', e.target.value)}
                    placeholder="10"
                    className="w-full p-2.5 bg-[#F0F4F1]/50 border border-[#8F9E8B]/30 rounded text-center font-bold"
                  />
                </div>
              </div>

              <div className="border-t border-dashed border-[#8F9E8B]/30 pt-4 space-y-4">
                <h4 className="font-rustic text-sm text-[#5C4A3C]">Dettaglio Pasti (per divisione quote)</h4>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[11px] uppercase font-bold text-gray-500 mb-1">Adulti a Pranzo</label>
                    <input
                      type="number"
                      value={getDayData(selectedDateStr).adultsLunch}
                      onChange={(e) => updateDayData(selectedDateStr, 'adultsLunch', e.target.value)}
                      placeholder="Vuoto = salta"
                      className="w-full p-2.5 bg-[#F0F4F1]/50 border border-[#8F9E8B]/30 rounded text-center font-bold"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] uppercase font-bold text-gray-500 mb-1">Adulti a Cena</label>
                    <input
                      type="number"
                      value={getDayData(selectedDateStr).adultsDinner}
                      onChange={(e) => updateDayData(selectedDateStr, 'adultsDinner', e.target.value)}
                      placeholder="Vuoto = salta"
                      className="w-full p-2.5 bg-[#F0F4F1]/50 border border-[#8F9E8B]/30 rounded text-center font-bold"
                    />
                  </div>
                </div>
              </div>

              <p className="text-[10px] italic text-gray-400 text-center pt-2">
                * Lasciando i campi vuoti, il sistema escluderà il pasto dal conteggio finale della spesa giornaliera.
              </p>
            </div>
          </div>
        )}

        {/* CONTENUTO SCHEDA: SPESA */}
        {activeTab === 'spesa' && (
          <div className="space-y-4">
            {/* Input Spese Giorno Corrente */}
            <div className="bg-white p-4 rounded-lg border-2 border-[#2D392C]/20 shadow-sm space-y-4">
              <h3 className="font-rustic text-lg border-b border-[#8F9E8B]/40 pb-2 text-[#2D392C]">
                Spese del {new Date(selectedDateStr).toLocaleDateString('it-IT', { day: 'numeric', month: 'long' })}
              </h3>

              <div className="space-y-3">
                <div>
                  <label className="block text-[11px] uppercase font-bold text-gray-500 mb-1">Spesa Cibo (€)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={getDayData(selectedDateStr).expenseFood}
                    onChange={(e) => updateDayData(selectedDateStr, 'expenseFood', e.target.value)}
                    placeholder="0.00"
                    className="w-full p-2.5 bg-[#F0F4F1]/50 border border-[#8F9E8B]/30 rounded font-bold"
                  />
                </div>
                <div>
                  <label className="block text-[11px] uppercase font-bold text-gray-500 mb-1">Spesa Bevande (€)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={getDayData(selectedDateStr).expenseDrinks}
                    onChange={(e) => updateDayData(selectedDateStr, 'expenseDrinks', e.target.value)}
                    placeholder="0.00"
                    className="w-full p-2.5 bg-[#F0F4F1]/50 border border-[#8F9E8B]/30 rounded font-bold"
                  />
                </div>
                <div>
                  <label className="block text-[11px] uppercase font-bold text-gray-500 mb-1">Spesa Accessoria (€)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={getDayData(selectedDateStr).expenseAccessory}
                    onChange={(e) => updateDayData(selectedDateStr, 'expenseAccessory', e.target.value)}
                    placeholder="Generatore, benzina, piatti..."
                    className="w-full p-2.5 bg-[#F0F4F1]/50 border border-[#8F9E8B]/30 rounded font-bold"
                  />
                </div>
              </div>

              {/* Totale Giorno */}
              <div className="bg-[#2D392C]/10 p-3 rounded border border-[#2D392C]/20 flex justify-between items-center">
                <span className="font-bold text-xs uppercase">Totale Giornata:</span>
                <span className="font-rustic font-bold text-lg text-[#2D392C]">
                  {totals.dailyBreakdown[selectedDateStr]?.totalCost.toFixed(2) || '0.00'} €
                </span>
              </div>
            </div>

            {/* Riepilogo Generale Campo */}
            <div className="bg-[#2D392C] text-[#F0F4F1] p-4 rounded-lg border-b-4 border-[#5C4A3C] shadow-md space-y-3">
              <h3 className="font-rustic text-lg border-b border-[#8F9E8B]/40 pb-1">
                Cassa Totale Campo
              </h3>
              
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="opacity-80">Totale Cibo:</span>
                  <span className="font-bold">{totals.totalFood.toFixed(2)} €</span>
                </div>
                <div className="flex justify-between">
                  <span className="opacity-80">Totale Bevande:</span>
                  <span className="font-bold">{totals.totalDrinks.toFixed(2)} €</span>
                </div>
                <div className="flex justify-between">
                  <span className="opacity-80">Totale Accessoria:</span>
                  <span className="font-bold">{totals.totalAccessory.toFixed(2)} €</span>
                </div>
                <div className="border-t border-[#8F9E8B]/30 pt-2 flex justify-between text-base font-bold text-[#D97706]">
                  <span>SPESA TOTALE:</span>
                  <span className="font-rustic">{totals.overallTotal.toFixed(2)} €</span>
                </div>
              </div>
            </div>
          </div>
        )}

      </main>

      {/* Footer / Info di servizio */}
      <footer className="fixed bottom-0 left-0 right-0 max-w-md mx-auto bg-white border-t border-gray-200 py-3 px-4 text-center text-[10px] text-gray-400 z-10 flex justify-around">
        <div>📍 Abruzzo, Pereto</div>
        <div>🔌 Gen: 3kW Max</div>
        <div>🧊 Frighi: 2 Attivi</div>
      </footer>
    </div>
  );
}
