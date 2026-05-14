import { useState, useEffect, useRef, useCallback } from "react";

// ─── SVG Shape Helpers ────────────────────────────────────────────────────────
const A = "#00d9ff";
const FILL = "#00d9ff";
const NONE = "none";

function circle(fill = NONE, stroke = A, r = 22) {
  const f = fill === "filled" ? FILL : fill;
  return `<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg"><circle cx="32" cy="32" r="${r}" fill="${f}" stroke="${stroke}" stroke-width="2.5"/></svg>`;
}
function square(fill = NONE, stroke = A, size = 40) {
  const o = (64 - size) / 2;
  const f = fill === "filled" ? FILL : fill;
  return `<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg"><rect x="${o}" y="${o}" width="${size}" height="${size}" fill="${f}" stroke="${stroke}" stroke-width="2.5"/></svg>`;
}
function triangle(fill = NONE, stroke = A) {
  const f = fill === "filled" ? FILL : fill;
  return `<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg"><polygon points="32,8 56,56 8,56" fill="${f}" stroke="${stroke}" stroke-width="2.5"/></svg>`;
}
function diamond(fill = NONE, stroke = A) {
  const f = fill === "filled" ? FILL : fill;
  return `<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg"><polygon points="32,6 58,32 32,58 6,32" fill="${f}" stroke="${stroke}" stroke-width="2.5"/></svg>`;
}
function rotShape(shape, deg, fill = NONE, stroke = A) {
  const f = fill === "filled" ? FILL : fill;
  const pts =
    shape === "square"
      ? `<rect x="14" y="14" width="36" height="36" fill="${f}" stroke="${stroke}" stroke-width="2.5" transform="rotate(${deg},32,32)"/>`
      : shape === "triangle"
      ? `<polygon points="32,10 54,54 10,54" fill="${f}" stroke="${stroke}" stroke-width="2.5" transform="rotate(${deg},32,32)"/>`
      : `<polygon points="32,6 58,32 32,58 6,32" fill="${f}" stroke="${stroke}" stroke-width="2.5" transform="rotate(${deg},32,32)"/>`;
  return `<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">${pts}</svg>`;
}
function lines(n, stroke = A) {
  const positions = [12, 22, 32, 42, 52];
  const ls = positions.slice(0, n).map((y) => `<line x1="8" y1="${y}" x2="56" y2="${y}" stroke="${stroke}" stroke-width="2.5"/>`).join("");
  return `<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">${ls}</svg>`;
}
function dots(n, fill = A) {
  const pos = [[20,20],[44,20],[20,44],[44,44],[32,32],[20,32],[44,32],[32,20],[32,44]];
  const pts = pos.slice(0, n).map(([x, y]) => `<circle cx="${x}" cy="${y}" r="6" fill="${fill}"/>`).join("");
  return `<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">${pts}</svg>`;
}
function sized(shape, r) {
  if (shape === "circle")
    return `<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg"><circle cx="32" cy="32" r="${r}" fill="${NONE}" stroke="${A}" stroke-width="2.5"/></svg>`;
  const s = r * 2, o = (64 - s) / 2;
  return `<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg"><rect x="${o}" y="${o}" width="${s}" height="${s}" fill="${NONE}" stroke="${A}" stroke-width="2.5"/></svg>`;
}

// ─── 20 Questions ─────────────────────────────────────────────────────────────
const QUESTIONS = [
  { id:1, type:"count", difficulty:"easy", meta:"Dot Count · Easy", hint:"Count the dots in each cell. Find the pattern across the row.", grid:[dots(1),dots(2),dots(3),dots(2),dots(3),dots(4),dots(3),dots(4),null], options:[dots(5),dots(4),dots(6),dots(3)], labels:["A","B","C","D"], answer:0, explanation:"Each row increases by 1 dot left to right. Row 3: 3 → 4 → 5.", rule:"Rule: +1 dot per step horizontally and vertically.", strategy:"Sum check: row totals are 6, 9, 12. Pattern is +1 per step." },
  { id:2, type:"fill", difficulty:"easy", meta:"Fill Alternation · Easy", hint:"Does each row alternate empty/filled or follow another pattern?", grid:[square(NONE),square("filled"),square(NONE),square("filled"),square(NONE),square("filled"),square(NONE),square("filled"),null], options:[square(NONE),square("filled"),circle(NONE),diamond(NONE)], labels:["A","B","C","D"], answer:0, explanation:"Fill alternates E/F/E per row. Row 3: empty → filled → empty.", rule:"Rule: Strict alternation. Odd positions = empty, even = filled.", strategy:"Read row 1 to get the starting fill. Odd rows start empty, even rows start filled." },
  { id:3, type:"size", difficulty:"easy", meta:"Size Growth · Easy", hint:"Calculate the size step between the first two cells in row 1.", grid:[sized("circle",8),sized("circle",16),sized("circle",24),sized("circle",12),sized("circle",20),sized("circle",28),sized("circle",16),sized("circle",24),null], options:[sized("circle",28),sized("circle",32),sized("circle",20),sized("circle",24)], labels:["A","B","C","D"], answer:1, explanation:"Step = +8 per cell. Row 3: 16 → 24 → 32.", rule:"Rule: +8 radius per step. Each row starts 4 larger than the previous.", strategy:"Step = cell2 − cell1. Apply: missing = cell2 + step. Never estimate by eye." },
  { id:4, type:"rotation", difficulty:"easy", meta:"Shape Rotation · Easy", hint:"How many degrees does the shape rotate between each cell?", grid:[rotShape("triangle",0),rotShape("triangle",60),rotShape("triangle",120),rotShape("triangle",60),rotShape("triangle",120),rotShape("triangle",180),rotShape("triangle",120),rotShape("triangle",180),null], options:[rotShape("triangle",180),rotShape("triangle",240),rotShape("triangle",120),rotShape("triangle",60)], labels:["A","B","C","D"], answer:1, explanation:"Each step adds 60°. Row 3: 120 → 180 → 240.", rule:"Rule: +60° per step horizontally.", strategy:"Calculate rotation step from row 1 cells 1 and 2. Apply cumulatively." },
  { id:5, type:"count", difficulty:"easy", meta:"Line Count · Easy", hint:"Check if each row sums to the same total.", grid:[lines(1),lines(3),lines(2),lines(4),lines(1),lines(1),lines(2),lines(2),null], options:[lines(2),lines(3),lines(1),lines(4)], labels:["A","B","C","D"], answer:0, explanation:"Each row sums to 6. Row 3: 2 + 2 + ? = 6 → ? = 2.", rule:"Rule: Constant row sum = 6. Missing = 6 − (c1 + c2).", strategy:"Sum row 1, verify row 2. If equal, missing = constant − (c1+c2). Takes 10 seconds." },
  { id:6, type:"fill", difficulty:"medium", meta:"Diagonal Fill · Medium", hint:"The filled cell moves position each row — track WHERE it moves, not just whether cells are filled.", grid:[circle(NONE),circle(NONE),circle("filled"),circle(NONE),circle("filled"),circle(NONE),circle("filled"),circle(NONE),null], options:[circle("filled"),circle(NONE),diamond("filled"),square(NONE)], labels:["A","B","C","D"], answer:1, explanation:"The filled circle moves one column left each row. Row 3 col 1 is filled, so col 3 is empty.", rule:"Rule: Single filled cell moves diagonally — one column left per row.", strategy:"Track WHERE the filled cell is, not just fill state. Diagonal movement is a classic Alva pattern." },
  { id:7, type:"size", difficulty:"medium", meta:"Decreasing Size · Medium", hint:"Sizes decrease — and the step itself may change per row.", grid:[sized("circle",28),sized("circle",22),sized("circle",16),sized("circle",24),sized("circle",20),sized("circle",16),sized("circle",20),sized("circle",18),null], options:[sized("circle",16),sized("circle",12),sized("circle",14),sized("circle",10)], labels:["A","B","C","D"], answer:0, explanation:"Row steps: −6, −4, −2. Row 3: 20 → 18 → 16.", rule:"Rule: Step shrinks by 2 each row (−6, −4, −2). Second-order progression.", strategy:"If the step isn't constant across rows, check if the step itself has a pattern." },
  { id:8, type:"rotation", difficulty:"medium", meta:"45° Rotation · Medium", hint:"Smaller rotation step — count carefully.", grid:[rotShape("square",0),rotShape("square",45),rotShape("square",90),rotShape("square",45),rotShape("square",90),rotShape("square",135),rotShape("square",90),rotShape("square",135),null], options:[rotShape("square",135),rotShape("square",180),rotShape("square",90),rotShape("square",45)], labels:["A","B","C","D"], answer:1, explanation:"Step = +45°. Row 3: 90 → 135 → 180.", rule:"Rule: +45° per step. Square at 180° looks identical to 0° — use column to verify.", strategy:"For squares, 180° = visually same as 0°. Always cross-check with column pattern." },
  { id:9, type:"count", difficulty:"medium", meta:"Latin Square · Medium", hint:"Does each value appear exactly once per row AND column?", grid:[dots(1),dots(3),dots(2),dots(3),dots(2),dots(1),dots(2),dots(1),null], options:[dots(4),dots(2),dots(3),dots(1)], labels:["A","B","C","D"], answer:2, explanation:"Each of {1,2,3} appears once per row and column. Row 3 has 2,1 → missing is 3.", rule:"Rule: Latin square of counts. Each value appears exactly once per row and column.", strategy:"When you see 3 distinct values, suspect Latin square. Missing = value not yet used in that row." },
  { id:10, type:"fill", difficulty:"medium", meta:"Shape Cycle · Medium", hint:"Each shape appears exactly once per row — like a Latin square of shapes.", grid:[circle(NONE),square(NONE),triangle(NONE),square(NONE),triangle(NONE),circle(NONE),triangle(NONE),circle(NONE),null], options:[triangle(NONE),circle(NONE),diamond(NONE),square(NONE)], labels:["A","B","C","D"], answer:3, explanation:"Each shape appears once per row and column. Row 3 has triangle, circle → missing is square.", rule:"Rule: Latin square of shapes — circle, square, triangle each appear once per row/column.", strategy:"Identify the 3 shapes. Find which is missing from the current row AND confirm with column." },
  { id:11, type:"size", difficulty:"medium", meta:"Diagonal Size · Medium", hint:"Check if size increases both horizontally AND vertically by the same step.", grid:[sized("square",10),sized("square",16),sized("square",22),sized("square",16),sized("square",22),sized("square",28),sized("square",22),sized("square",28),null], options:[sized("square",28),sized("square",34),sized("square",32),sized("square",22)], labels:["A","B","C","D"], answer:1, explanation:"Step = +6 both horizontally and vertically. Column 3: 22, 28, 34.", rule:"Rule: cell(r,c) = 10 + 6*(r+c). Same step in both directions.", strategy:"Cross-check: missing = (cell above) + step = (cell left) + step. Both must agree." },
  { id:12, type:"rotation", difficulty:"medium", meta:"Diamond Rotation · Medium", hint:"Track the rotation step, then verify with the column.", grid:[rotShape("diamond",0),rotShape("diamond",30),rotShape("diamond",60),rotShape("diamond",30),rotShape("diamond",60),rotShape("diamond",90),rotShape("diamond",60),rotShape("diamond",90),null], options:[rotShape("diamond",90),rotShape("diamond",120),rotShape("diamond",60),rotShape("diamond",150)], labels:["A","B","C","D"], answer:1, explanation:"Step = +30°. Row 3: 60 → 90 → 120.", rule:"Rule: +30° per step. Column 3 confirms: 60, 90, 120.", strategy:"Always verify rotation answer against the column — row and column should give the same result." },
  { id:13, type:"fill", difficulty:"medium", meta:"Fill + Shape Combined · Medium", hint:"Two variables changing — separate them. Handle shape first, then fill.", grid:[circle(NONE),circle("filled"),square(NONE),circle("filled"),square(NONE),square("filled"),square(NONE),square("filled"),null], options:[circle(NONE),circle("filled"),square(NONE),triangle(NONE)], labels:["A","B","C","D"], answer:0, explanation:"Shape cycles circle→square diagonally. Fill alternates E/F/E. Bottom-right: circle (shape) + empty (fill).", rule:"Rule: Shape cycles along diagonal; fill alternates independently.", strategy:"When two variables change simultaneously, SEPARATE them. Solve shape pattern, then fill pattern independently." },
  { id:14, type:"count", difficulty:"hard", meta:"Column Sum Rule · Hard", hint:"Rows may not sum to the same total — check columns instead.", grid:[lines(1),lines(2),lines(4),lines(3),lines(4),lines(2),lines(5),lines(3),null], options:[lines(3),lines(1),lines(2),lines(4)], labels:["A","B","C","D"], answer:0, explanation:"Each column sums to 9. Col 3: 4 + 2 + ? = 9 → ? = 3.", rule:"Rule: Each column sums to 9. Missing = 9 − (col sum so far).", strategy:"When rows don't have equal sums, check columns. One of rows/columns/diagonals will have a constant sum." },
  {
    id:15, type:"fill", difficulty:"hard", meta:"Dual Shape Fill · Hard", hint:"Two shapes per cell — each has its own independent alternation.",
    grid:[
      `<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg"><circle cx="20" cy="32" r="12" fill="${NONE}" stroke="${A}" stroke-width="2"/><rect x="34" y="20" width="22" height="22" fill="${FILL}" stroke="${A}" stroke-width="2"/></svg>`,
      `<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg"><circle cx="20" cy="32" r="12" fill="${FILL}" stroke="${A}" stroke-width="2"/><rect x="34" y="20" width="22" height="22" fill="${NONE}" stroke="${A}" stroke-width="2"/></svg>`,
      `<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg"><circle cx="20" cy="32" r="12" fill="${NONE}" stroke="${A}" stroke-width="2"/><rect x="34" y="20" width="22" height="22" fill="${FILL}" stroke="${A}" stroke-width="2"/></svg>`,
      `<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg"><circle cx="20" cy="32" r="12" fill="${FILL}" stroke="${A}" stroke-width="2"/><rect x="34" y="20" width="22" height="22" fill="${NONE}" stroke="${A}" stroke-width="2"/></svg>`,
      `<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg"><circle cx="20" cy="32" r="12" fill="${NONE}" stroke="${A}" stroke-width="2"/><rect x="34" y="20" width="22" height="22" fill="${FILL}" stroke="${A}" stroke-width="2"/></svg>`,
      `<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg"><circle cx="20" cy="32" r="12" fill="${FILL}" stroke="${A}" stroke-width="2"/><rect x="34" y="20" width="22" height="22" fill="${NONE}" stroke="${A}" stroke-width="2"/></svg>`,
      `<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg"><circle cx="20" cy="32" r="12" fill="${NONE}" stroke="${A}" stroke-width="2"/><rect x="34" y="20" width="22" height="22" fill="${FILL}" stroke="${A}" stroke-width="2"/></svg>`,
      `<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg"><circle cx="20" cy="32" r="12" fill="${FILL}" stroke="${A}" stroke-width="2"/><rect x="34" y="20" width="22" height="22" fill="${NONE}" stroke="${A}" stroke-width="2"/></svg>`,
      null
    ],
    options:[
      `<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg"><circle cx="20" cy="32" r="12" fill="${NONE}" stroke="${A}" stroke-width="2"/><rect x="34" y="20" width="22" height="22" fill="${FILL}" stroke="${A}" stroke-width="2"/></svg>`,
      `<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg"><circle cx="20" cy="32" r="12" fill="${FILL}" stroke="${A}" stroke-width="2"/><rect x="34" y="20" width="22" height="22" fill="${NONE}" stroke="${A}" stroke-width="2"/></svg>`,
      `<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg"><circle cx="20" cy="32" r="12" fill="${FILL}" stroke="${A}" stroke-width="2"/><rect x="34" y="20" width="22" height="22" fill="${FILL}" stroke="${A}" stroke-width="2"/></svg>`,
      `<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg"><circle cx="20" cy="32" r="12" fill="${NONE}" stroke="${A}" stroke-width="2"/><rect x="34" y="20" width="22" height="22" fill="${NONE}" stroke="${A}" stroke-width="2"/></svg>`,
    ],
    labels:["A","B","C","D"], answer:1, explanation:"Circle: E,F,E,F,E,F,E,F → next F. Square: F,E,F,E,F,E,F,E → next E. Answer B: filled circle + empty square.", rule:"Rule: Each shape alternates independently. They are always opposite each other.", strategy:"Decompose multi-shape cells. Write out each shape's fill sequence separately, then combine."
  },
  { id:16, type:"size", difficulty:"hard", meta:"Mixed Size + Shape · Hard", hint:"Shape changes row by row. Size changes cell by cell. Track independently.", grid:[sized("circle",10),sized("circle",18),sized("circle",26),sized("square",12),sized("square",20),sized("square",28),sized("circle",14),sized("circle",22),null], options:[sized("circle",30),sized("square",30),sized("circle",28),sized("square",26)], labels:["A","B","C","D"], answer:0, explanation:"Shape: row 1=circle, row 2=square, row 3=circle (alternates). Size step=+8. Row 3 col 3: 14+8+8=30. Answer: circle at size 30.", rule:"Rule: Shape alternates per row. Size increases +8 per step regardless of shape.", strategy:"Two independent variables. Solve shape rule first (which shape?), then size rule (what size?)." },
  { id:17, type:"rotation", difficulty:"hard", meta:"Rotation + Fill · Hard", hint:"Write out just the fills separately from the rotation — treat as two independent sequences.", grid:[rotShape("diamond",0,NONE),rotShape("diamond",45,NONE),rotShape("diamond",90,"filled"),rotShape("diamond",45,NONE),rotShape("diamond",90,"filled"),rotShape("diamond",135,NONE),rotShape("diamond",90,"filled"),rotShape("diamond",135,NONE),null], options:[rotShape("diamond",180,"filled"),rotShape("diamond",180,NONE),rotShape("diamond",135,"filled"),rotShape("diamond",45,NONE)], labels:["A","B","C","D"], answer:1, explanation:"Rotation: +45° → missing = 180°. Fill per row: (E,E,F),(E,F,E),(F,E,?) — each row shifts pattern right → ? = E. Answer B: 180° rotation, empty.", rule:"Rule: +45° rotation. Fill pattern shifts one position right each row.", strategy:"SEPARATE rotation and fill. Write fills only: E,E,F / E,F,E / F,E,? — pattern is obvious without rotation distraction." },
  { id:18, type:"count", difficulty:"hard", meta:"Second-Order Count · Hard", hint:"The difference between cells may itself follow a pattern.", grid:[dots(1),dots(2),dots(4),dots(2),dots(4),dots(7),dots(4),dots(7),null], options:[dots(9),dots(10),dots(11),dots(8)], labels:["A","B","C","D"], answer:2, explanation:"Differences: row 1 gaps +1,+2. Row 2 gaps +2,+3. Row 3 gaps +3,+4. So 7+4=11.", rule:"Rule: The step between cells increases by 1 each row. Row 3: +3, +4.", strategy:"When no constant sum/product works, calculate the gaps between cells. The gaps themselves may form a sequence." },
  {
    id:19, type:"fill", difficulty:"hard", meta:"Three-Variable · Hard", hint:"Shape, fill, AND size all change. Tackle one variable at a time.",
    grid:[
      sized("circle",20),
      `<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg"><rect x="12" y="12" width="40" height="40" fill="${FILL}" stroke="${A}" stroke-width="2.5"/></svg>`,
      `<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg"><polygon points="32,8 56,56 8,56" fill="${NONE}" stroke="${A}" stroke-width="2.5"/></svg>`,
      `<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg"><rect x="12" y="12" width="40" height="40" fill="${FILL}" stroke="${A}" stroke-width="2.5"/></svg>`,
      `<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg"><polygon points="32,8 56,56 8,56" fill="${NONE}" stroke="${A}" stroke-width="2.5"/></svg>`,
      sized("circle",20),
      `<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg"><polygon points="32,8 56,56 8,56" fill="${NONE}" stroke="${A}" stroke-width="2.5"/></svg>`,
      sized("circle",20),
      null
    ],
    options:[
      `<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg"><rect x="12" y="12" width="40" height="40" fill="${FILL}" stroke="${A}" stroke-width="2.5"/></svg>`,
      `<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg"><polygon points="32,8 56,56 8,56" fill="${NONE}" stroke="${A}" stroke-width="2.5"/></svg>`,
      sized("circle",20),
      `<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg"><rect x="12" y="12" width="40" height="40" fill="${NONE}" stroke="${A}" stroke-width="2.5"/></svg>`,
    ],
    labels:["A","B","C","D"], answer:0, explanation:"Shapes cycle circle/square/triangle. Row 3: triangle, circle, ? → square. Fill alternates per row — position 9 = filled. Answer A: filled square.", rule:"Rule: Shape cycles circle/square/triangle. Fill alternates independently per row.", strategy:"With 3 variables, list them as separate columns and solve each sequence independently."
  },
  { id:20, type:"rotation", difficulty:"hard", meta:"Compound Rotation · Hard", hint:"The rotation step itself increases each row. Find the meta-pattern.", grid:[rotShape("triangle",0),rotShape("triangle",20),rotShape("triangle",40),rotShape("triangle",20),rotShape("triangle",50),rotShape("triangle",80),rotShape("triangle",40),rotShape("triangle",80),null], options:[rotShape("triangle",100),rotShape("triangle",120),rotShape("triangle",110),rotShape("triangle",130)], labels:["A","B","C","D"], answer:1, explanation:"Row steps: +20,+20 (row1); +30,+30 (row2); +40,+40 (row3). Row 3: 40 → 80 → 120.", rule:"Rule: Step increases by +10 each row (+20, +30, +40). Second-order rotation.", strategy:"If step isn't constant across rows, the step itself is the pattern. Calculate step for rows 1 and 2, find the meta-step." },
];

const TYPE_LABELS = { fill:"Fill Alternation", size:"Size Progression", rotation:"Rotation", count:"Line / Count" };
const TYPE_COLORS = { fill:"#fbbf24", size:"#00d9ff", rotation:"#8b5cf6", count:"#ff006e" };
const DIFF_COLORS = { easy:"#4ade80", medium:"#fbbf24", hard:"#ff006e" };
const TOTAL_TIME = 120;
const MONO = "'JetBrains Mono','Courier New',monospace";

export default function AlvaPrepModule() {
  const [phase, setPhase] = useState("intro");
  const [current, setCurrent] = useState(0);
  const [answered, setAnswered] = useState(false);
  const [selected, setSelected] = useState(null);
  const [showExplanation, setShowExplanation] = useState(false);
  const [timeLeft, setTimeLeft] = useState(TOTAL_TIME);
  const [results, setResults] = useState([]);
  const [timePerQuestion, setTimePerQuestion] = useState([]);
  const timerRef = useRef(null);
  const questionStartRef = useRef(Date.now());
  const q = QUESTIONS[current];

  const stopTimer = useCallback(() => { if (timerRef.current) clearInterval(timerRef.current); }, []);

  const startTimer = useCallback(() => {
    stopTimer();
    setTimeLeft(TOTAL_TIME);
    questionStartRef.current = Date.now();
    timerRef.current = setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) {
          stopTimer();
          setAnswered(true); setShowExplanation(true);
          const elapsed = Math.round((Date.now() - questionStartRef.current) / 1000);
          setTimePerQuestion((prev) => [...prev, elapsed]);
          setResults((prev) => [...prev, { id: QUESTIONS[current]?.id, correct: false, skipped: true, type: QUESTIONS[current]?.type, difficulty: QUESTIONS[current]?.difficulty }]);
          return 0;
        }
        return t - 1;
      });
    }, 1000);
  }, [stopTimer, current]);

  useEffect(() => { if (phase === "quiz") startTimer(); return stopTimer; }, [phase, current]);

  const handleSelect = (i) => {
    if (answered) return;
    stopTimer();
    const elapsed = Math.round((Date.now() - questionStartRef.current) / 1000);
    setSelected(i); setAnswered(true); setShowExplanation(true);
    setTimePerQuestion((prev) => [...prev, elapsed]);
    setResults((prev) => [...prev, { id: q.id, correct: i === q.answer, skipped: false, type: q.type, difficulty: q.difficulty, timeSpent: elapsed }]);
  };

  const handleNext = () => {
    if (current + 1 >= QUESTIONS.length) { setPhase("results"); }
    else { setCurrent((c) => c + 1); setAnswered(false); setSelected(null); setShowExplanation(false); }
  };

  const handleSkip = () => {
    if (answered) return;
    stopTimer();
    const elapsed = Math.round((Date.now() - questionStartRef.current) / 1000);
    setAnswered(true); setShowExplanation(true);
    setTimePerQuestion((prev) => [...prev, elapsed]);
    setResults((prev) => [...prev, { id: q.id, correct: false, skipped: true, type: q.type, difficulty: q.difficulty, timeSpent: elapsed }]);
  };

  const restart = () => {
    setCurrent(0); setAnswered(false); setSelected(null); setShowExplanation(false); setResults([]); setTimePerQuestion([]);
    setPhase("quiz");
  };

  // ── Shared style tokens ──
  const card = { background:"rgba(10,14,26,0.6)", border:"1px solid rgba(0,217,255,0.15)", borderRadius:"8px", padding:"20px", position:"relative", overflow:"hidden" };
  const topLine = { position:"absolute", top:0, left:0, right:0, height:"1px", background:"linear-gradient(90deg,transparent,rgba(0,217,255,0.4),transparent)" };
  const sectionLabel = { fontFamily:MONO, fontSize:"10px", fontWeight:700, color:"rgba(0,217,255,0.7)", textTransform:"uppercase", letterSpacing:"0.12em" };

  // ── INTRO ──────────────────────────────────────────────────────────────────
  if (phase === "intro") return (
    <div style={{ color:"#e2e8f0" }}>
      <style>{`@keyframes accentGlow{0%,100%{box-shadow:0 0 10px rgba(0,217,255,0.5),0 0 20px rgba(139,92,246,0.3)}50%{box-shadow:0 0 20px rgba(0,217,255,0.8),0 0 30px rgba(139,92,246,0.5)}} @keyframes fadeIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}`}</style>

      <div style={{ marginBottom:"28px" }}>
        <div style={{ display:"flex", alignItems:"center", gap:"12px", marginBottom:"6px" }}>
          <div style={{ width:"8px", height:"32px", background:"linear-gradient(180deg,#00d9ff 0%,#8b5cf6 100%)", borderRadius:"2px", animation:"accentGlow 3s ease-in-out infinite", flexShrink:0 }} />
          <h1 style={{ fontFamily:MONO, fontSize:"18px", fontWeight:800, margin:0, color:"#fff", textTransform:"uppercase", letterSpacing:"0.1em", textShadow:"0 0 20px rgba(0,217,255,0.3)" }}>Logic Test Simulator</h1>
        </div>
        <p style={{ color:"rgba(148,163,184,0.7)", fontSize:"13px", margin:"0 0 0 20px", paddingLeft:"20px" }}>20 questions · 2 minutes per question · Full result analysis</p>
      </div>

      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(180px,1fr))", gap:"10px", marginBottom:"16px" }}>
        {Object.entries(TYPE_LABELS).map(([key, label]) => (
          <div key={key} style={{ ...card, border:`1px solid ${TYPE_COLORS[key]}33`, padding:"14px 16px" }}>
            <div style={{ position:"absolute", top:0, left:0, right:0, height:"2px", background:`linear-gradient(90deg,transparent,${TYPE_COLORS[key]},transparent)` }} />
            <div style={{ fontFamily:MONO, fontSize:"11px", fontWeight:700, color:TYPE_COLORS[key], textTransform:"uppercase", letterSpacing:"0.1em", marginBottom:"4px" }}>{label}</div>
            <div style={{ fontSize:"12px", color:"rgba(148,163,184,0.6)" }}>
              {key==="fill"&&"Track empty/filled patterns"}{key==="size"&&"Calculate size steps precisely"}{key==="rotation"&&"Find rotation angles"}{key==="count"&&"Sum rules and Latin squares"}
            </div>
          </div>
        ))}
      </div>

      <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:"10px", marginBottom:"16px" }}>
        {[["easy",5],["medium",8],["hard",7]].map(([d,n]) => (
          <div key={d} style={{ ...card, border:`1px solid ${DIFF_COLORS[d]}33`, textAlign:"center", padding:"16px" }}>
            <div style={{ fontFamily:MONO, fontSize:"30px", fontWeight:800, color:DIFF_COLORS[d], textShadow:`0 0 20px ${DIFF_COLORS[d]}55`, lineHeight:1 }}>{n}</div>
            <div style={{ fontFamily:MONO, fontSize:"10px", color:"rgba(148,163,184,0.5)", textTransform:"uppercase", letterSpacing:"0.1em", marginTop:"6px" }}>{d}</div>
          </div>
        ))}
      </div>

      <div style={{ ...card, marginBottom:"24px" }}>
        <div style={topLine} />
        <div style={{ ...sectionLabel, marginBottom:"14px" }}>Strategy Quick Reference</div>
        {[["Fill",TYPE_COLORS.fill,"Read row 1 fill sequence. Apply to row 3. Verify with columns."],["Size",TYPE_COLORS.size,"Step = cell2 − cell1. Missing = cell2 + step. Never estimate."],["Rotation",TYPE_COLORS.rotation,"Calculate angle step from row 1. Apply cumulatively."],["Count",TYPE_COLORS.count,"Sum row 1. If rows constant-sum, missing = total − (c1+c2)."]].map(([t,c,d]) => (
          <div key={t} style={{ display:"flex", gap:"14px", padding:"8px 0", borderBottom:"1px solid rgba(139,92,246,0.1)" }}>
            <span style={{ fontFamily:MONO, fontSize:"11px", color:c, fontWeight:700, minWidth:"70px", letterSpacing:"0.06em" }}>{t}</span>
            <span style={{ fontSize:"12px", color:"rgba(148,163,184,0.8)", lineHeight:1.6 }}>{d}</span>
          </div>
        ))}
      </div>

      <button onClick={() => setPhase("quiz")} className="btn-primary" style={{ fontSize:"13px", letterSpacing:"0.08em" }}>Start Test</button>
    </div>
  );

  // ── RESULTS ────────────────────────────────────────────────────────────────
  if (phase === "results") {
    const total = results.length;
    const correct = results.filter(r=>r.correct).length;
    const pct = Math.round((correct/total)*100);
    const avgTime = timePerQuestion.length ? Math.round(timePerQuestion.reduce((a,b)=>a+b,0)/timePerQuestion.length) : 0;
    const byType = Object.keys(TYPE_LABELS).map(type => { const qs=results.filter(r=>r.type===type); const c=qs.filter(r=>r.correct).length; return {type,correct:c,total:qs.length,pct:qs.length?Math.round((c/qs.length)*100):0}; });
    const byDiff = ["easy","medium","hard"].map(d => { const qs=results.filter(r=>r.difficulty===d); const c=qs.filter(r=>r.correct).length; return {difficulty:d,correct:c,total:qs.length,pct:qs.length?Math.round((c/qs.length)*100):0}; });
    const weakTypes = byType.filter(t=>t.pct<60&&t.total>0);
    const rating = pct>=85?{label:"Excellent",color:"#4ade80",sub:"Above average candidate range."}:pct>=65?{label:"Competitive",color:"#00d9ff",sub:"Within competitive range. Targeted practice recommended."}:pct>=45?{label:"Developing",color:"#fbbf24",sub:"Below average. Focus on weak pattern types before the real test."}:{label:"Needs Work",color:"#ff006e",sub:"Significant practice needed. Drill weak types daily."};

    return (
      <div style={{ color:"#e2e8f0" }}>
        <style>{`@keyframes accentGlow{0%,100%{box-shadow:0 0 10px rgba(0,217,255,0.5)}50%{box-shadow:0 0 20px rgba(0,217,255,0.8)}}`}</style>
        <div style={{ display:"flex", alignItems:"center", gap:"12px", marginBottom:"24px" }}>
          <div style={{ width:"8px", height:"32px", background:"linear-gradient(180deg,#00d9ff 0%,#8b5cf6 100%)", borderRadius:"2px", animation:"accentGlow 3s ease-in-out infinite", flexShrink:0 }} />
          <div>
            <h1 style={{ fontFamily:MONO, fontSize:"16px", fontWeight:800, margin:0, color:"#fff", textTransform:"uppercase", letterSpacing:"0.1em" }}>Test Complete</h1>
            <p style={{ color:"rgba(148,163,184,0.6)", fontSize:"12px", margin:0 }}>Full result analysis</p>
          </div>
        </div>

        {/* Score */}
        <div style={{ ...card, marginBottom:"14px", display:"flex", gap:"28px", alignItems:"center", flexWrap:"wrap" }}>
          <div style={{ position:"absolute", top:0, left:0, right:0, height:"2px", background:`linear-gradient(90deg,transparent,${rating.color},transparent)` }} />
          <div style={{ textAlign:"center" }}>
            <div style={{ fontFamily:MONO, fontSize:"56px", fontWeight:800, color:rating.color, lineHeight:1, textShadow:`0 0 30px ${rating.color}55` }}>{correct}<span style={{ fontSize:"24px", color:"rgba(148,163,184,0.4)" }}>/{total}</span></div>
            <div style={{ fontFamily:MONO, fontSize:"11px", color:"rgba(148,163,184,0.5)", marginTop:"4px" }}>{pct}% correct</div>
          </div>
          <div style={{ flex:1, minWidth:"200px" }}>
            <div style={{ fontFamily:MONO, fontSize:"14px", fontWeight:700, color:rating.color, marginBottom:"6px", textTransform:"uppercase", letterSpacing:"0.08em" }}>{rating.label}</div>
            <div style={{ fontSize:"13px", color:"rgba(148,163,184,0.8)", lineHeight:1.6, marginBottom:"14px" }}>{rating.sub}</div>
            <div style={{ display:"flex", gap:"20px" }}>
              {[["Avg time/q",`${avgTime}s`,avgTime>90?"#ff006e":avgTime>60?"#fbbf24":"#4ade80"],["Skipped",String(results.filter(r=>r.skipped).length),"rgba(148,163,184,0.8)"]].map(([l,v,c])=>(
                <div key={l}>
                  <div style={{ fontFamily:MONO, fontSize:"10px", color:"rgba(148,163,184,0.4)", textTransform:"uppercase", letterSpacing:"0.1em", marginBottom:"2px" }}>{l}</div>
                  <div style={{ fontFamily:MONO, fontSize:"16px", color:c }}>{v}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Pattern breakdown */}
        <div style={{ ...card, marginBottom:"14px" }}>
          <div style={topLine} />
          <div style={{ ...sectionLabel, marginBottom:"14px" }}>Pattern Type Breakdown</div>
          {byType.map(t=>(
            <div key={t.type} style={{ display:"flex", alignItems:"center", gap:"12px", marginBottom:"10px" }}>
              <div style={{ fontFamily:MONO, fontSize:"11px", color:TYPE_COLORS[t.type], fontWeight:700, width:"130px", flexShrink:0 }}>{TYPE_LABELS[t.type]}</div>
              <div style={{ flex:1, height:"3px", background:"rgba(139,92,246,0.15)", borderRadius:"2px", overflow:"hidden" }}>
                <div style={{ height:"100%", width:`${t.pct}%`, background:t.pct>=70?"#4ade80":t.pct>=40?"#fbbf24":"#ff006e", borderRadius:"2px", transition:"width 0.8s ease" }} />
              </div>
              <div style={{ fontFamily:MONO, fontSize:"11px", color:"rgba(148,163,184,0.6)", minWidth:"80px", textAlign:"right" }}>{t.correct}/{t.total} ({t.pct}%)</div>
            </div>
          ))}
        </div>

        {/* Difficulty */}
        <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:"10px", marginBottom:"14px" }}>
          {byDiff.map(d=>(
            <div key={d.difficulty} style={{ ...card, border:`1px solid ${DIFF_COLORS[d.difficulty]}33`, textAlign:"center", padding:"14px" }}>
              <div style={{ fontFamily:MONO, fontSize:"24px", fontWeight:800, color:DIFF_COLORS[d.difficulty], textShadow:`0 0 15px ${DIFF_COLORS[d.difficulty]}44` }}>{d.pct}%</div>
              <div style={{ fontFamily:MONO, fontSize:"10px", color:"rgba(148,163,184,0.4)", textTransform:"uppercase", letterSpacing:"0.08em", margin:"4px 0 2px" }}>{d.difficulty}</div>
              <div style={{ fontSize:"11px", color:"rgba(148,163,184,0.4)" }}>{d.correct}/{d.total}</div>
            </div>
          ))}
        </div>

        {/* Recommendations */}
        <div style={{ ...card, marginBottom:"14px" }}>
          <div style={topLine} />
          <div style={{ ...sectionLabel, marginBottom:"14px" }}>Recommendations</div>
          {weakTypes.length===0?(
            <div style={{ padding:"12px 14px", background:"rgba(74,222,128,0.06)", border:"1px solid rgba(74,222,128,0.2)", borderRadius:"6px", fontSize:"13px", color:"#4ade80" }}>Strong across all pattern types. Focus on reducing time per question before the real test.</div>
          ):weakTypes.map(t=>(
            <div key={t.type} style={{ marginBottom:"10px", padding:"12px 14px", background:"rgba(255,0,110,0.06)", border:"1px solid rgba(255,0,110,0.2)", borderRadius:"6px" }}>
              <div style={{ fontFamily:MONO, fontSize:"11px", fontWeight:700, color:"#ff006e", marginBottom:"6px", textTransform:"uppercase", letterSpacing:"0.08em" }}>Weak — {TYPE_LABELS[t.type]} ({t.pct}%)</div>
              <div style={{ fontSize:"12px", color:"rgba(148,163,184,0.8)", lineHeight:1.7 }}>
                {t.type==="fill"&&"Read row 1 fill sequence first. Track WHERE filled cells move, not just whether each cell is filled."}
                {t.type==="size"&&"Always calculate the step (cell2 − cell1) before looking at options. Never estimate by eye."}
                {t.type==="rotation"&&"Calculate angle step from row 1. Cross-check your answer with the column pattern."}
                {t.type==="count"&&"Sum row 1 immediately. If rows have equal sums, missing = total − (c1 + c2). Takes under 10 seconds."}
              </div>
            </div>
          ))}
          {avgTime>90&&(
            <div style={{ padding:"12px 14px", background:"rgba(251,191,36,0.06)", border:"1px solid rgba(251,191,36,0.2)", borderRadius:"6px" }}>
              <div style={{ fontFamily:MONO, fontSize:"11px", fontWeight:700, color:"#fbbf24", marginBottom:"6px", textTransform:"uppercase", letterSpacing:"0.08em" }}>Speed — avg {avgTime}s per question</div>
              <div style={{ fontSize:"12px", color:"rgba(148,163,184,0.8)" }}>Real test allows 2 minutes. Practice pattern recognition until first-scan identification becomes automatic.</div>
            </div>
          )}
        </div>

        {/* Question log */}
        <div style={{ ...card, marginBottom:"24px" }}>
          <div style={topLine} />
          <div style={{ ...sectionLabel, marginBottom:"14px" }}>Question Log</div>
          <div style={{ display:"flex", flexWrap:"wrap", gap:"5px" }}>
            {results.map((r,i)=>(
              <div key={i} title={`Q${r.id} · ${TYPE_LABELS[r.type]} · ${r.difficulty}`} style={{ width:"34px", height:"34px", borderRadius:"4px", display:"flex", alignItems:"center", justifyContent:"center", fontFamily:MONO, fontSize:"11px", cursor:"default", background:r.skipped?"rgba(30,41,59,0.5)":r.correct?"rgba(74,222,128,0.1)":"rgba(255,0,110,0.1)", border:`1px solid ${r.skipped?"rgba(100,116,139,0.3)":r.correct?"rgba(74,222,128,0.4)":"rgba(255,0,110,0.4)"}`, color:r.skipped?"rgba(100,116,139,0.6)":r.correct?"#4ade80":"#ff006e" }}>
                {r.skipped?"—":r.correct?"✓":"✕"}
              </div>
            ))}
          </div>
        </div>

        <div style={{ display:"flex", gap:"12px" }}>
          <button onClick={restart} className="btn-primary" style={{ fontSize:"13px" }}>Retake Test</button>
          <button onClick={()=>setPhase("intro")} className="btn-cancel" style={{ padding:"0.5rem 1.5rem", fontSize:"13px" }}>Back</button>
        </div>
      </div>
    );
  }

  // ── QUIZ ───────────────────────────────────────────────────────────────────
  const timerPct = (timeLeft/TOTAL_TIME)*100;
  const timerColor = timeLeft<=30?"#ff006e":timeLeft<=60?"#fbbf24":"#00d9ff";
  const lastResult = results[results.length-1];

  return (
    <div style={{ color:"#e2e8f0" }}>
      <style>{`@keyframes fadeSlide{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}`}</style>

      {/* Progress bar */}
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"14px" }}>
        <div style={{ display:"flex", alignItems:"center", gap:"8px" }}>
          <span style={{ fontFamily:MONO, fontSize:"11px", color:"rgba(148,163,184,0.6)", textTransform:"uppercase", letterSpacing:"0.1em" }}>Q {current+1} / {QUESTIONS.length}</span>
          <span style={{ fontFamily:MONO, fontSize:"10px", padding:"2px 8px", borderRadius:"3px", textTransform:"uppercase", letterSpacing:"0.08em", background:`${DIFF_COLORS[q.difficulty]}18`, border:`1px solid ${DIFF_COLORS[q.difficulty]}44`, color:DIFF_COLORS[q.difficulty] }}>{q.difficulty}</span>
          <span style={{ fontFamily:MONO, fontSize:"10px", padding:"2px 8px", borderRadius:"3px", background:`${TYPE_COLORS[q.type]}18`, border:`1px solid ${TYPE_COLORS[q.type]}44`, color:TYPE_COLORS[q.type] }}>{TYPE_LABELS[q.type]}</span>
        </div>
        <div style={{ display:"flex", gap:"3px" }}>
          {QUESTIONS.map((_,i)=>{ const r=results[i]; const isCur=i===current; return <div key={i} style={{ width:"7px", height:"7px", borderRadius:"50%", background:isCur?"#00d9ff":r?(r.correct?"#4ade80":r.skipped?"rgba(100,116,139,0.3)":"#ff006e"):"rgba(30,41,59,0.5)", transition:"background 0.2s", boxShadow:isCur?"0 0 6px rgba(0,217,255,0.8)":"none" }} />; })}
        </div>
      </div>

      {/* Timer */}
      <div style={{ display:"flex", justifyContent:"space-between", marginBottom:"5px" }}>
        <span style={{ fontFamily:MONO, fontSize:"12px", color:timerColor, textShadow:timeLeft<=30?`0 0 10px ${timerColor}`:"none" }}>{Math.floor(timeLeft/60)}:{String(timeLeft%60).padStart(2,"0")}</span>
        <span style={{ fontFamily:MONO, fontSize:"10px", color:"rgba(148,163,184,0.3)" }}>2:00 limit</span>
      </div>
      <div style={{ height:"3px", background:"rgba(30,41,59,0.8)", borderRadius:"2px", marginBottom:"18px", overflow:"hidden" }}>
        <div style={{ height:"100%", width:`${timerPct}%`, background:timerColor, borderRadius:"2px", transition:"width 1s linear, background 0.3s", boxShadow:`0 0 8px ${timerColor}88` }} />
      </div>

      {/* Question card */}
      <div style={{ ...card, marginBottom:"12px", animation:"fadeSlide 0.25s ease" }} key={current}>
        <div style={topLine} />
        <div style={{ fontFamily:MONO, fontSize:"11px", color:"rgba(148,163,184,0.5)", textTransform:"uppercase", letterSpacing:"0.1em", marginBottom:"5px" }}>{q.meta}</div>
        <div style={{ fontSize:"13px", color:"rgba(148,163,184,0.6)", marginBottom:"14px" }}>Which shape correctly completes the matrix?</div>

        {/* Hint */}
        <div style={{ background:"rgba(0,217,255,0.04)", border:"1px solid rgba(0,217,255,0.12)", borderRadius:"5px", padding:"9px 12px", marginBottom:"18px" }}>
          <span style={{ fontFamily:MONO, fontSize:"10px", color:"rgba(148,163,184,0.35)", textTransform:"uppercase", letterSpacing:"0.1em", marginRight:"10px" }}>Hint</span>
          <span style={{ fontSize:"12px", color:"rgba(0,217,255,0.75)" }}>{q.hint}</span>
        </div>

        {/* Matrix */}
        <div style={{ display:"flex", justifyContent:"center", marginBottom:"22px" }}>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(3,84px)", gridTemplateRows:"repeat(3,84px)", gap:"5px" }}>
            {q.grid.map((cell,i)=>(
              <div key={i} style={{ width:"84px", height:"84px", borderRadius:"4px", display:"flex", alignItems:"center", justifyContent:"center", background:cell===null?"rgba(0,217,255,0.03)":"rgba(15,20,25,0.7)", border:cell===null?"1.5px dashed rgba(0,217,255,0.45)":"1px solid rgba(139,92,246,0.12)", boxShadow:cell===null?"inset 0 0 10px rgba(0,217,255,0.04)":"none" }}>
                {cell===null?<span style={{ fontFamily:MONO, fontSize:"20px", color:"rgba(0,217,255,0.65)", textShadow:"0 0 10px rgba(0,217,255,0.35)" }}>?</span>:<div style={{ width:"64px", height:"64px" }} dangerouslySetInnerHTML={{ __html:cell }} />}
              </div>
            ))}
          </div>
        </div>

        {/* Options */}
        <div style={{ fontFamily:MONO, fontSize:"10px", color:"rgba(148,163,184,0.4)", textTransform:"uppercase", letterSpacing:"0.1em", marginBottom:"10px" }}>Select answer</div>
        <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:"8px", marginBottom:answered?"18px":0 }}>
          {q.options.map((svg,i)=>{
            const isCorrect=i===q.answer; const isSelected=selected===i;
            let border="1px solid rgba(139,92,246,0.2)", bg="rgba(15,20,25,0.6)", shadow="none";
            if (answered) {
              if (isCorrect) { border="1px solid rgba(74,222,128,0.55)"; bg="rgba(74,222,128,0.07)"; shadow="0 0 12px rgba(74,222,128,0.12)"; }
              else if (isSelected) { border="1px solid rgba(255,0,110,0.55)"; bg="rgba(255,0,110,0.07)"; shadow="0 0 12px rgba(255,0,110,0.12)"; }
            }
            return (
              <button key={i} onClick={()=>handleSelect(i)} disabled={answered}
                style={{ background:bg, border, borderRadius:"5px", padding:"10px 6px", cursor:answered?"default":"pointer", display:"flex", flexDirection:"column", alignItems:"center", gap:"5px", transition:"all 0.15s", boxShadow:shadow, fontFamily:"inherit" }}
                onMouseEnter={e=>{ if(!answered){e.currentTarget.style.borderColor="rgba(0,217,255,0.45)"; e.currentTarget.style.background="rgba(0,217,255,0.05)"; e.currentTarget.style.boxShadow="0 0 15px rgba(0,217,255,0.15)";} }}
                onMouseLeave={e=>{ if(!answered){e.currentTarget.style.borderColor="rgba(139,92,246,0.2)"; e.currentTarget.style.background="rgba(15,20,25,0.6)"; e.currentTarget.style.boxShadow="none";} }}>
                <div style={{ width:"52px", height:"52px" }} dangerouslySetInnerHTML={{ __html:svg }} />
                <span style={{ fontFamily:MONO, fontSize:"10px", color:"rgba(148,163,184,0.45)", textTransform:"uppercase", letterSpacing:"0.1em" }}>{q.labels[i]}</span>
              </button>
            );
          })}
        </div>

        {/* Explanation */}
        {showExplanation&&(
          <div style={{ borderLeft:`2px solid ${lastResult?.skipped?"rgba(100,116,139,0.4)":lastResult?.correct?"rgba(74,222,128,0.55)":"rgba(255,0,110,0.55)"}`, borderRadius:"0 5px 5px 0", padding:"13px 15px", background:"rgba(10,14,26,0.8)", animation:"fadeSlide 0.2s ease" }}>
            <div style={{ fontFamily:MONO, fontSize:"10px", textTransform:"uppercase", letterSpacing:"0.08em", color:lastResult?.skipped?"rgba(100,116,139,0.7)":lastResult?.correct?"#4ade80":"#ff006e", marginBottom:"7px" }}>
              {lastResult?.skipped?`Skipped — Answer: ${q.labels[q.answer]}`:lastResult?.correct?"Correct":`Wrong — Answer: ${q.labels[q.answer]}`}
            </div>
            <p style={{ fontSize:"13px", color:"rgba(148,163,184,0.8)", lineHeight:1.7, margin:"0 0 9px" }}>{q.explanation}</p>
            <div style={{ fontFamily:MONO, fontSize:"12px", color:"#00d9ff", background:"rgba(0,217,255,0.04)", border:"1px solid rgba(0,217,255,0.12)", padding:"8px 11px", borderRadius:"4px", marginBottom:"9px" }}>{q.rule}</div>
            <div style={{ fontSize:"12px", color:"rgba(148,163,184,0.65)", lineHeight:1.6 }}>
              <span style={{ fontFamily:MONO, fontSize:"10px", color:"#8b5cf6", textTransform:"uppercase", letterSpacing:"0.08em", marginRight:"8px" }}>Faster next time</span>{q.strategy}
            </div>
          </div>
        )}
      </div>

      {/* Actions */}
      <div style={{ display:"flex", justifyContent:"flex-end", gap:"10px" }}>
        {!answered&&<button onClick={handleSkip} className="btn-cancel" style={{ padding:"0.5rem 1.25rem", fontSize:"13px" }}>Skip</button>}
        {answered&&<button onClick={handleNext} className="btn-primary" style={{ fontSize:"13px" }}>{current+1>=QUESTIONS.length?"See Results":"Next"}</button>}
      </div>
    </div>
  );
}
