// Grayboard: matches retired professionals with small groups of teenagers who want to learn what they know.
import { useMemo, useState } from "react";
import { downloadIcs } from "./lib/ics";
import { waLink } from "./lib/share";
import { uid, useStored } from "./lib/store";
import { Section, Stat, Stats } from "./ui/kit";

const T = "grayboard";
const SLOTS = ["Mon eve", "Tue eve", "Wed eve", "Thu eve", "Fri eve", "Sat am", "Sat pm", "Sun am"];
type Mentor = { id: string; name: string; was: string; skills: string[]; slots: string[]; max: number; phone: string };
type Learner = { id: string; name: string; age: number; wants: string[]; slots: string[]; phone: string };
const SKILLS = ["Carpentry", "Accounting", "Cooking", "Electronics", "Sewing", "Public speaking", "Photography", "Gardening", "Car mechanics", "Coding", "Calligraphy", "Chess"];
const SAMPLE_M: Mentor[] = [
  { id: "m1", name: "Hedi (72)", was: "Cabinet maker for 40 years", skills: ["Carpentry"], slots: ["Sat am", "Wed eve"], max: 4, phone: "" },
  { id: "m2", name: "Fatma (66)", was: "Chief accountant at a bank", skills: ["Accounting", "Public speaking"], slots: ["Tue eve", "Thu eve"], max: 5, phone: "" },
  { id: "m3", name: "Moncef (69)", was: "Electrical engineer", skills: ["Electronics", "Car mechanics"], slots: ["Sat pm", "Sun am"], max: 3, phone: "" },
  { id: "m4", name: "Aicha (70)", was: "Tailor and pattern cutter", skills: ["Sewing"], slots: ["Wed eve", "Sat pm"], max: 4, phone: "" },
];
const SAMPLE_L: Learner[] = [
  { id: "l1", name: "Yassine", age: 15, wants: ["Carpentry", "Electronics"], slots: ["Sat am", "Sat pm"], phone: "" }, { id: "l2", name: "Maram", age: 16, wants: ["Accounting", "Public speaking"], slots: ["Tue eve"], phone: "" },
  { id: "l3", name: "Aziz", age: 14, wants: ["Electronics"], slots: ["Sun am", "Sat pm"], phone: "" }, { id: "l4", name: "Lina", age: 17, wants: ["Sewing", "Photography"], slots: ["Wed eve"], phone: "" },
  { id: "l5", name: "Omar", age: 16, wants: ["Carpentry"], slots: ["Wed eve", "Sat am"], phone: "" }, { id: "l6", name: "Sarra", age: 15, wants: ["Public speaking"], slots: ["Thu eve", "Tue eve"], phone: "" },
  { id: "l7", name: "Nader", age: 17, wants: ["Car mechanics", "Carpentry"], slots: ["Sat pm"], phone: "" },
];

/** Greedy matching: each learner goes to the mentor sharing the most skills and a time slot, until mentors are full. */
function match(mentors: Mentor[], learners: Learner[]) {
  const groups = mentors.map(m => ({ m, members: [] as { l: Learner; skill: string; slot: string }[] }));
  const unmatched: Learner[] = [];
  const cands = learners.map(l => ({ l, opts: groups.flatMap(g => { const skill = l.wants.find(w => g.m.skills.includes(w)); const slot = l.slots.find(s => g.m.slots.includes(s)); return skill && slot ? [{ g, skill, slot, score: l.wants.filter(w => g.m.skills.includes(w)).length }] : []; }) })).sort((a, b) => a.opts.length - b.opts.length);
  cands.forEach(({ l, opts }) => { const best = opts.filter(o => o.g.members.length < o.g.m.max).sort((a, b) => b.score - a.score || a.g.members.length - b.g.members.length)[0]; if (best) best.g.members.push({ l, skill: best.skill, slot: best.slot }); else unmatched.push(l); });
  return { groups, unmatched };
}

export default function Grayboard() {
  const [mentors, setMentors] = useStored<Mentor[]>(T, "mentors", SAMPLE_M);
  const [learners, setLearners] = useStored<Learner[]>(T, "learners", SAMPLE_L);
  const [place, setPlace] = useStored(T, "place", "Maison des Jeunes, El Menzah");
  const [tab, setTab] = useState<"groups" | "mentors" | "learners">("groups");
  const [nm, setNm] = useState({ name: "", was: "", skills: [] as string[], slots: [] as string[] });
  const [nl, setNl] = useState({ name: "", age: "15", wants: [] as string[], slots: [] as string[] });
  const { groups, unmatched } = useMemo(() => match(mentors, learners), [mentors, learners]);
  const toggle = (arr: string[], v: string) => (arr.includes(v) ? arr.filter(x => x !== v) : [...arr, v]);
  const chips = (all: string[], sel: string[], on: (v: string) => void) => <div className="row" style={{ gap: 4 }}>{all.map(v => <button type="button" key={v} className="btn small" aria-pressed={sel.includes(v)} style={sel.includes(v) ? { background: "var(--ink)", color: "var(--bg)" } : undefined} onClick={() => on(v)}>{v}</button>)}</div>;
  const nextDateFor = (slot: string) => { const dayIdx = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(slot.slice(0, 3)); const d = new Date(); d.setDate(d.getDate() + ((dayIdx - d.getDay() + 7) % 7 || 7)); d.setHours(slot.endsWith("am") ? 10 : slot.endsWith("pm") ? 15 : 18, 0, 0, 0); return d; };

  return (
    <div className="stack">
      <Section title="Grayboard programme" aside={<div className="seg-mini"><button aria-pressed={tab === "groups"} onClick={() => setTab("groups")}>Groups</button><button aria-pressed={tab === "mentors"} onClick={() => setTab("mentors")}>Mentors</button><button aria-pressed={tab === "learners"} onClick={() => setTab("learners")}>Learners</button></div>}>
        <Stats><Stat value={mentors.length} label="Mentors" /><Stat value={learners.length} label="Learners" /><Stat value={learners.length - unmatched.length} label="Matched" tone="good" /><Stat value={unmatched.length} label="Waiting for a mentor" tone={unmatched.length ? "warn" : undefined} /></Stats>
      </Section>
      {tab === "groups" && <>
        <div className="gb-groups">{groups.filter(g => g.members.length).map(g => (
          <section key={g.m.id} className="panel gb-g">
            <p className="eyebrow">{g.members[0].slot} · {g.members.length} of {g.m.max} places</p>
            <h2 style={{ margin: "4px 0" }}>{g.m.name}</h2>
            <p className="note">{g.m.was}</p>
            <ul>{g.members.map(x => <li key={x.l.id}><strong>{x.l.name}</strong>, {x.l.age} · wants {x.skill.toLowerCase()}</li>)}</ul>
            <div className="row">
              <a className="btn small" href={waLink(`Hello ${g.m.name.split(" ")[0]}, your Grayboard group meets ${g.members[0].slot} at ${place}: ${g.members.map(x => x.l.name).join(", ")}. Thank you for sharing what you know!`, g.m.phone)} target="_blank" rel="noreferrer">Tell the mentor</a>
              <button className="btn small" onClick={() => downloadIcs(`grayboard-${g.m.name.split(" ")[0]}.ics`, [{ title: `Grayboard: ${g.m.skills.join(" and ")} with ${g.m.name.split(" ")[0]}`, start: nextDateFor(g.members[0].slot), end: new Date(nextDateFor(g.members[0].slot).getTime() + 90 * 60000), location: place, rrule: "FREQ=WEEKLY;COUNT=8" }], "Grayboard")}>8 weekly sessions to calendar</button>
            </div>
          </section>
        ))}</div>
        {unmatched.length > 0 && <Section title="Still looking for a mentor">{unmatched.map(l => <p key={l.id}>{l.name} wants {l.wants.join(" or ").toLowerCase()} on {l.slots.join(", ")}</p>)}<p className="note">Recruit a mentor with these skills, or ask these learners about other times.</p></Section>}
        <label className="field" style={{ maxWidth: 400 }}><span>Where groups meet</span><input className="input" value={place} onChange={e => setPlace(e.target.value)} /></label>
      </>}
      {tab === "mentors" && <Section title="Mentors">
        {mentors.map(m => <div key={m.id} className="gb-row"><div style={{ flex: 1 }}><strong>{m.name}</strong> <span className="note">{m.was}</span><p className="note">{m.skills.join(", ")} · {m.slots.join(", ")} · up to {m.max}</p></div><button className="btn ghost small danger" onClick={() => setMentors(mentors.filter(x => x.id !== m.id))}>Remove</button></div>)}
        <form className="stack" style={{ gap: 8, marginTop: 12 }} onSubmit={e => { e.preventDefault(); if (!nm.name.trim() || !nm.skills.length) return; setMentors([...mentors, { id: uid(), ...nm, name: nm.name.trim(), max: 4, phone: "" }]); setNm({ name: "", was: "", skills: [], slots: [] }); }}>
          <div className="row"><input className="input" style={{ flex: 1 }} aria-label="Name" placeholder="Name and age" value={nm.name} onChange={e => setNm({ ...nm, name: e.target.value })} /><input className="input" style={{ flex: 2 }} aria-label="Career" placeholder="What they did" value={nm.was} onChange={e => setNm({ ...nm, was: e.target.value })} /></div>
          {chips(SKILLS, nm.skills, v => setNm({ ...nm, skills: toggle(nm.skills, v) }))}{chips(SLOTS, nm.slots, v => setNm({ ...nm, slots: toggle(nm.slots, v) }))}
          <button className="btn small primary" type="submit" style={{ alignSelf: "flex-start" }}>Add mentor</button>
        </form>
      </Section>}
      {tab === "learners" && <Section title="Learners">
        {learners.map(l => <div key={l.id} className="gb-row"><div style={{ flex: 1 }}><strong>{l.name}</strong>, {l.age}<p className="note">Wants {l.wants.join(", ")} · free {l.slots.join(", ")}</p></div><button className="btn ghost small danger" onClick={() => setLearners(learners.filter(x => x.id !== l.id))}>Remove</button></div>)}
        <form className="stack" style={{ gap: 8, marginTop: 12 }} onSubmit={e => { e.preventDefault(); if (!nl.name.trim() || !nl.wants.length) return; setLearners([...learners, { id: uid(), name: nl.name.trim(), age: parseInt(nl.age) || 15, wants: nl.wants, slots: nl.slots, phone: "" }]); setNl({ name: "", age: "15", wants: [], slots: [] }); }}>
          <div className="row"><input className="input" style={{ flex: 2 }} aria-label="Name" placeholder="First name" value={nl.name} onChange={e => setNl({ ...nl, name: e.target.value })} /><input className="input num" style={{ flex: 1 }} aria-label="Age" value={nl.age} onChange={e => setNl({ ...nl, age: e.target.value })} /></div>
          {chips(SKILLS, nl.wants, v => setNl({ ...nl, wants: toggle(nl.wants, v) }))}{chips(SLOTS, nl.slots, v => setNl({ ...nl, slots: toggle(nl.slots, v) }))}
          <button className="btn small primary" type="submit" style={{ alignSelf: "flex-start" }}>Add learner</button>
        </form>
        <p className="note" style={{ marginTop: 10 }}>For learners under 18, collect parental consent and hold sessions in a public place with a coordinator present.</p>
      </Section>}
      <style>{`.gb-groups{display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:14px}.gb-g{border-top:6px solid var(--accent);display:grid;gap:6px}.gb-g ul{margin:6px 0;padding-left:18px}.gb-row{display:flex;gap:10px;align-items:center;padding:8px 0;border-bottom:1px solid var(--line)}`}</style>
    </div>
  );
}
