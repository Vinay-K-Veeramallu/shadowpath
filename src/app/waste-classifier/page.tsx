"use client";

import { useState } from "react";

export default function WasteClassifierPage() {
  const [text, setText] = useState("");
  const [image, setImage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => setImage(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text && !image) return;
    
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const res = await fetch("/api/classify-waste", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, image }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to classify");
      
      setResult(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const binColors = {
    red: "bg-red-500",
    blue: "bg-blue-500",
    green: "bg-green-500",
    grey: "bg-gray-500"
  };

  return (
    <div className="sp-page-bg min-h-[calc(100vh-4rem)] p-4 sm:p-8">
      <div className="mx-auto max-w-4xl space-y-8">
        <header>
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 hc:text-black">
            Waste Classifier & Impact
          </h1>
          <p className="mt-2 text-slate-600 hc:text-black">
            Upload an image or describe your waste to find the right bin and see the climate impact.
          </p>
        </header>

        <div className="grid gap-8 md:grid-cols-2">
          <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-card">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700">What do you want to throw away?</label>
                <input
                  type="text"
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder="e.g. Empty plastic water bottle"
                  className="mt-1 block w-full rounded-xl border border-slate-300 px-4 py-2 focus:border-blue-500 focus:ring-blue-500"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-slate-700">Or upload a photo</label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  className="mt-1 block w-full text-sm text-slate-500 file:mr-4 file:rounded-full file:border-0 file:bg-blue-50 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-blue-700 hover:file:bg-blue-100"
                />
                {image && (
                  <img src={image} alt="Preview" className="mt-4 h-32 w-32 rounded-lg object-cover shadow-sm" />
                )}
              </div>

              <button
                type="submit"
                disabled={loading || (!text && !image)}
                className="w-full rounded-full bg-blue-600 px-4 py-2.5 font-semibold text-white shadow-sm hover:bg-blue-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:opacity-50"
              >
                {loading ? "Analyzing..." : "Classify Waste"}
              </button>
            </form>

            {error && <p className="mt-4 text-sm text-red-600">{error}</p>}
          </section>

          {result && (
            <section className="space-y-6">
              <div className="flex items-center gap-4 rounded-3xl border border-slate-200 bg-white p-6 shadow-card">
                <div className={`h-16 w-16 shrink-0 rounded-2xl ${binColors[result.bin as keyof typeof binColors]} shadow-inner`} />
                <div>
                  <h2 className="text-xl font-bold uppercase tracking-wide text-slate-900">{result.bin} BIN</h2>
                  <p className="mt-1 text-sm text-slate-600">{result.reasoning}</p>
                </div>
              </div>

              <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-card">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-lg font-bold text-slate-900">Waste & Climate Impact Dashboard</h3>
                  <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-900">
                    Model-based comparison
                  </span>
                </div>

                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-emerald-700">Emissions Reduced</p>
                    <p className="mt-1 text-2xl font-bold text-emerald-900">-{result.impact.reducedEmissions}%</p>
                    <p className="mt-1 text-xs text-emerald-900">Estimated CO2e reduction by proper disposal</p>
                  </div>
                  <div className="rounded-xl border border-blue-200 bg-blue-50 p-3">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-blue-700">Resources Saved</p>
                    <p className="mt-1 text-lg font-bold text-blue-900">{result.impact.resourceSaved}</p>
                    <p className="mt-1 text-xs text-blue-900">Materials kept in the circular economy</p>
                  </div>
                </div>

                <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-sm font-semibold text-slate-900">Interdependency chain</p>
                  <div className="mt-3 grid gap-2 sm:grid-cols-3">
                    <div className="rounded-lg bg-white p-2 text-xs">
                      <p className="font-semibold text-slate-800">Your choice</p>
                      <p className="mt-1 text-slate-600">Selected: {result.bin.charAt(0).toUpperCase() + result.bin.slice(1)} Bin</p>
                    </div>
                    <div className="rounded-lg bg-white p-2 text-xs">
                      <p className="font-semibold text-slate-800">Resource impact</p>
                      <p className="mt-1 text-slate-600">Material recovered instead of landfilled</p>
                    </div>
                    <div className="rounded-lg bg-white p-2 text-xs">
                      <p className="font-semibold text-slate-800">Climate effect</p>
                      <p className="mt-1 text-slate-600">{result.impact.climateEffect}</p>
                    </div>
                  </div>
                </div>
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
