import React, { useState, useEffect, useCallback } from "react";
import { useNavigate, Link } from "react-router-dom";
import { User, Lock, ArrowRight, Eye, EyeOff } from "lucide-react";
import toast from "react-hot-toast";
import { supabase } from "../lib/supabase";
import { prefetchTables } from "../lib/useData";
import { saveMemberSession, loadSavedCredentials, saveCredentials } from "../lib/auth";
import AuthShell, { ORANGE_GRADIENT } from "./AuthShell";
import AuthInput from "./AuthInput";

export default function Login() {
  const nav = useNavigate();
  const [form, setForm] = useState({ username: "", password: "" });
  const [showPwd, setShowPwd] = useState(true);
  const [busy, setBusy] = useState(false);
  const [savedCreds, setSavedCreds] = useState([]);

  useEffect(() => {
    const saved = loadSavedCredentials();
    setSavedCreds(saved);
    // Auto-fill the last used credential
    if (saved.length > 0) {
      const last = saved[saved.length - 1];
      setForm({ username: last.username, password: last.password });
    }
  }, []);

  const fillCredential = useCallback((cred) => {
    setForm({ username: cred.username, password: cred.password });
  }, []);

  async function submit(e) {
    e.preventDefault();
    if (!form.username || !form.password) {
      toast.error("Please enter username and password");
      return;
    }
    setBusy(true);
    try {
      const { data: members, error } = await supabase
        .from("members")
        .select("*")
        .eq("username", form.username)
        .limit(1);
      if (error) throw error;
      const member = members?.[0];
      if (!member || member.password !== form.password) {
        toast.error("Invalid username or password");
        setBusy(false);
        return;
      }
      // Auto-save credentials on this device for quick re-login
      const updated = saveCredentials(form.username, form.password);
      setSavedCreds(updated);
      saveMemberSession(member.id);
      prefetchTables(["members", "system_settings", "maintenance_codes", "transactions"]);
      toast.success(`Welcome back, ${member.full_name}!`);
      nav("/Dashboard");
    } catch (err) {
      toast.error(err.message || "Login failed. Please try again.");
    }
    setBusy(false);
  }

  return (
    <AuthShell title="ProductPrime Member Log In">
      <form onSubmit={submit} className="space-y-6">
        <AuthInput
          label="Username"
          required
          icon={User}
          name="username"
          autoComplete="username"
          value={form.username}
          onChange={e => setForm({ ...form, username: e.target.value })}
          placeholder="Enter your username"
        />
        <AuthInput
          label="Password"
          required
          icon={Lock}
          type={showPwd ? "text" : "password"}
          name="password"
          autoComplete="current-password"
          value={form.password}
          onChange={e => setForm({ ...form, password: e.target.value })}
          placeholder="Enter your password"
          trailing={
            <button type="button" onClick={() => setShowPwd(!showPwd)} className="hover:opacity-80">
              {showPwd ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
            </button>
          }
        />
        <button
          type="submit"
          disabled={busy}
          className="w-full h-[52px] rounded-xl text-white text-base font-medium flex items-center justify-center gap-3 shadow-lg hover:brightness-110 transition disabled:opacity-60"
          style={{ background: ORANGE_GRADIENT }}
        >
          {busy ? "Signing in..." : "Login"} <ArrowRight className="w-5 h-5" />
        </button>

        {savedCreds.length > 0 && (
          <div className="space-y-2">
            <p className="text-white text-sm">Saved on this device — tap to fill:</p>
            <div className="flex flex-wrap gap-2">
              {savedCreds.map((cred) => (
                <button
                  key={cred.username}
                  type="button"
                  onClick={() => fillCredential(cred)}
                  className="px-4 py-2 rounded-full text-white text-sm border border-white/30 hover:border-orange-400 hover:bg-white/10 transition"
                  style={{ background: "rgba(255,255,255,0.15)" }}
                >
                  @{cred.username}
                </button>
              ))}
            </div>
          </div>
        )}

        <p className="text-center text-white text-[17px]">
          Don't have an account? <Link to="/Register" className="text-orange-400 hover:underline">Register here</Link>
        </p>
      </form>
    </AuthShell>
  );
}
