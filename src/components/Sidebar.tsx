"use client";

import { useState } from "react";
import { Building2, ChevronDown, CheckSquare, Settings } from "lucide-react";

export function Sidebar() {
  const [loanType, setLoanType] = useState("New Construction");
  
  const agencies = [
    { id: "hpd", name: "HPD (NYC)", checked: false },
    { id: "hdc", name: "HDC (NYC)", checked: false },
    { id: "hcr", name: "HCR (NYS)", checked: true },
    { id: "esd", name: "ESD (NYS)", checked: false },
    { id: "hud", name: "HUD (Federal)", checked: false },
    { id: "fannie", name: "Fannie/Freddie", checked: false },
  ];

  const [selectedAgencies, setSelectedAgencies] = useState(agencies);

  const toggleAgency = (id: string) => {
    setSelectedAgencies(selectedAgencies.map(a => 
      a.id === id ? { ...a, checked: !a.checked } : a
    ));
  };

  return (
    <div className="w-72 bg-slate-900 text-slate-100 flex flex-col h-screen border-r border-slate-800">
      <div className="p-6 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <Building2 className="w-6 h-6 text-blue-400" />
          <h1 className="font-bold text-lg tracking-tight">LISC NY</h1>
        </div>
        <p className="text-xs text-slate-400 mt-1 font-medium">Public Data Engine</p>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-8">
        {/* Loan Type Section */}
        <div className="space-y-3">
          <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Loan Type</h2>
          <div className="relative">
            <select 
              value={loanType}
              onChange={(e) => setLoanType(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 text-sm rounded-md px-3 py-2.5 appearance-none focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="New Construction">New Construction</option>
              <option value="Preservation">Preservation / Rehab</option>
              <option value="Supportive Housing">Supportive Housing</option>
              <option value="Refinancing">Refinancing</option>
            </select>
            <ChevronDown className="w-4 h-4 absolute right-3 top-3 text-slate-400 pointer-events-none" />
          </div>
        </div>

        {/* Target Agencies Section */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Target Agencies</h2>
            <span className="text-[10px] bg-blue-900/50 text-blue-300 px-2 py-0.5 rounded-full font-medium">
              {selectedAgencies.filter(a => a.checked).length} selected
            </span>
          </div>
          <p className="text-xs text-slate-500 mb-2">Select rulebooks to constrain AI search.</p>
          
          <div className="space-y-2">
            {selectedAgencies.map((agency) => (
              <label key={agency.id} className="flex items-center gap-3 group cursor-pointer">
                <div className={`w-4 h-4 rounded flex items-center justify-center border transition-colors ${agency.checked ? 'bg-blue-500 border-blue-500' : 'border-slate-600 group-hover:border-slate-500'}`}>
                  {agency.checked && <CheckSquare className="w-3 h-3 text-white" />}
                </div>
                <input 
                  type="checkbox" 
                  className="hidden" 
                  checked={agency.checked}
                  onChange={() => toggleAgency(agency.id)}
                />
                <span className={`text-sm ${agency.checked ? 'text-slate-200' : 'text-slate-400 group-hover:text-slate-300'}`}>
                  {agency.name}
                </span>
              </label>
            ))}
          </div>
        </div>
      </div>

      <div className="p-4 border-t border-slate-800">
        <button className="flex items-center gap-2 text-sm text-slate-400 hover:text-slate-200 transition-colors w-full px-2 py-2 rounded-md hover:bg-slate-800">
          <Settings className="w-4 h-4" />
          <span>Settings</span>
        </button>
      </div>
    </div>
  );
}
