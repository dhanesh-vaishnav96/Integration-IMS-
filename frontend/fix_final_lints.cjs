const fs = require('fs');

const f1 = 'src/components/scheduling/AvailabilityLayer.jsx';
let c1 = fs.readFileSync(f1, 'utf8');
c1 = c1.replace(/let bgClass = '';/, "let bgClass = 'bg-slate-500/5 border-slate-500/10';"); // Give it a default value and use it, actually the switch statement already assigns it.
// Oh wait, why does it say "not used in subsequent statements" if it is used in the JSX below it?
// Let me check AvailabilityLayer again.
fs.writeFileSync(f1, c1, 'utf8');

const f2 = 'src/components/scheduling/FilterPanel.jsx';
let c2 = fs.readFileSync(f2, 'utf8');
c2 = c2.replace(/const allEvents = useSchedulingStore\(s => s.events\);\n/, '');
fs.writeFileSync(f2, c2, 'utf8');

const f3 = 'src/components/scheduling/InterviewModal.jsx';
let c3 = fs.readFileSync(f3, 'utf8');
c3 = c3.replace(/const \{ events, setEvents \} = useSchedulingStore\(\);/, 'const { events } = useSchedulingStore();');
fs.writeFileSync(f3, c3, 'utf8');

const f4 = 'src/components/scheduling/views/AgendaView.jsx';
let c4 = fs.readFileSync(f4, 'utf8');
c4 = c4.replace(/const selectedDate = useSchedulingStore\(s => s\.selectedDate\);\n/, '');
fs.writeFileSync(f4, c4, 'utf8');

const f5 = 'src/components/scheduling/views/WeekView.jsx';
let c5 = fs.readFileSync(f5, 'utf8');
c5 = c5.replace(/const dragState = useSchedulingStore\(s => s\.dragState\);\n/, '');
fs.writeFileSync(f5, c5, 'utf8');

const f6 = 'src/hooks/scheduling/useWebSocket.js';
let c6 = fs.readFileSync(f6, 'utf8');
c6 = c6.replace(/const \{ analytics, setAnalytics \} = useSchedulingStore\(\);/, 'const { analytics } = useSchedulingStore();');
fs.writeFileSync(f6, c6, 'utf8');

console.log('done');
