import { useState } from "react";
import { ModalShell } from "./ui.jsx";
import { PROFILES } from "../config.js";
import { login } from "../lib/api.js";

/* EDIT sign-in: pick who you are, type the shared house password.
   The password is verified by the server (/api/login), never in the browser. */
export default function EditLoginModal({ onClose, onSuccess, lastProfile }) {
  const [profile, setProfile] = useState(lastProfile || "");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);

  const submit = async (e) => {
    e?.preventDefault();
    setErr(null);
    if (!profile) { setErr("Choose who you are."); return; }
    if (!password) { setErr("Enter the password."); return; }
    setBusy(true);
    try { onSuccess(await login(profile, password)); }
    catch (e2) { setErr(e2.message || "Could not sign in."); }
    finally { setBusy(false); }
  };

  return (
    <ModalShell title="Edit mode" subtitle="Choose your profile to start editing" onClose={onClose} maxWidth={440} icon="pencil">
      <form className="modal-body" onSubmit={submit}>
        <div className="profile-grid" role="group" aria-label="Who are you?">
          {PROFILES.map(p => (
            <button key={p} type="button" aria-pressed={profile === p}
              className={`profile-btn${profile === p ? " on" : ""}`} onClick={() => setProfile(p)}>
              <span className="avatar" aria-hidden="true">{p[0]}</span>
              <span>{p.toUpperCase()}</span>
            </button>
          ))}
        </div>
        <label className="form-field">
          <span className="form-label">Password</span>
          <div className="pw-wrap">
            <input className="field" type={show ? "text" : "password"} value={password}
              onChange={e => setPassword(e.target.value)} autoComplete="current-password" placeholder="House password"
              {...(lastProfile ? { "data-autofocus": true } : {})} />
            <button type="button" className="eye-btn" aria-label={show ? "Hide password" : "Show password"} onClick={() => setShow(s => !s)}>
              <i className={`ti ti-${show ? "eye-off" : "eye"}`} />
            </button>
          </div>
        </label>
        {err && <p className="form-error" role="alert">{err}</p>}
        <div className="modal-actions">
          <button type="button" onClick={onClose} className="btn">Cancel</button>
          <button type="submit" disabled={busy} className="btn btn-edit">
            <i className={`ti ti-${busy ? "loader-2 spin" : "lock-open"}`} />Start editing
          </button>
        </div>
      </form>
    </ModalShell>
  );
}
