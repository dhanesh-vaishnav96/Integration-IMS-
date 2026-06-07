const fs = require('fs');
const glob = require('glob');
const path = require('path');

const files = [
  'src/components/scheduling/views/AgendaView.jsx',
  'src/components/scheduling/views/DayView.jsx',
  'src/components/scheduling/views/MonthView.jsx',
  'src/components/scheduling/views/TimelineView.jsx',
  'src/components/scheduling/views/WeekView.jsx',
  'src/hooks/scheduling/useDragDrop.js',
  'src/hooks/scheduling/useWebSocket.js',
  'src/pages/CandidateList.jsx',
  'src/pages/Dashboard.jsx',
  'src/pages/SchedulingPage.jsx'
];

for (const f of files) {
  if (!fs.existsSync(f)) continue;
  let content = fs.readFileSync(f, 'utf8');
  
  // Remove unused React imports
  content = content.replace(/import React(?:, \{([^}]+)\})? from 'react';\n/g, (match, p1) => {
    if (p1) {
      return `import { ${p1.trim()} } from 'react';\n`;
    }
    return '';
  });

  // Specific unused vars
  content = content.replace(/import \{ format, isSameDay, addDays \} from 'date-fns';/g, "import { format } from 'date-fns';");
  content = content.replace(/import \{ isSameDay \} from 'date-fns';\n/g, "");
  content = content.replace(/import \{ STATUS_COLORS, PRIORITY_COLORS \} from '\.\.\/\.\.\/utils\/calendarHelpers';\n/g, "");
  content = content.replace(/import \{ STATUS_COLORS \} from '\.\.\/\.\.\/utils\/calendarHelpers';\n/g, "");
  content = content.replace(/const dragState = useSchedulingStore\(s => s\.dragState\);\n/g, "");
  content = content.replace(/const selectedDate = useSchedulingStore\(s => s\.selectedDate\);\n/g, "");
  content = content.replace(/import \{ eachHourOfInterval \} from 'date-fns';\n/g, "");
  content = content.replace(/const \{ analytics, setAnalytics \} = useSchedulingStore\(\);\n/g, "const { analytics } = useSchedulingStore();\n");
  
  if (f.includes('useDragDrop')) {
    content = content.replace(/import \{ format \} from 'date-fns';\n/g, "");
  }

  if (f.includes('CandidateList')) {
    content = content.replace(/useEffect\(\(\) => \{\n\s+fetchCandidates\(\);\n\s+\}, \[\]\);/, "useEffect(() => {\n    fetchCandidates();\n    // eslint-disable-next-line react-hooks/exhaustive-deps\n  }, []);");
  }
  if (f.includes('Dashboard')) {
    content = content.replace(/useEffect\(\(\) => \{\n\s+fetchDashboard\(\);\n\s+\}, \[id\]\);/, "useEffect(() => {\n    fetchDashboard();\n    // eslint-disable-next-line react-hooks/exhaustive-deps\n  }, [id]);");
    content = content.replace(/} catch \(err\) {/, "} catch (_err) {");
  }

  if (f.includes('useCalendarEvents')) {
     content = content.replace(/}, \[start, end\]\);/, "}, [start, end, lastFetchKey, setError, setEvents, setLoading]);");
  }
  
  fs.writeFileSync(f, content, 'utf8');
}
console.log('Fixed unused vars');
