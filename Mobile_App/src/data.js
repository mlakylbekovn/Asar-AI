export const initialVolunteers = [
  { id:'v1', name:'Аружан', initials:'А', area:'Есіл', skills:['food','delivery','support'], times:['Бүгін','Ертең','Апта ішінде'], available:true, load:0, capacity:2, color:'#E5DBF8' },
  { id:'v2', name:'Данияр', initials:'Д', area:'Нұра', skills:['delivery','community','food'], times:['Бүгін','Апта ішінде'], available:true, load:1, capacity:2, color:'#DBE9FF' },
  { id:'v3', name:'Мадина', initials:'М', area:'Сарыарқа', skills:['study','support'], times:['Ертең','Апта ішінде'], available:true, load:0, capacity:2, color:'#FBEAD5' },
  { id:'v4', name:'Әлібек', initials:'Ә', area:'Алматы', skills:['delivery','food','community'], times:['Бүгін','Ертең'], available:true, load:0, capacity:2, color:'#E3F5DB' },
  { id:'v5', name:'Айсұлу', initials:'А', area:'Байқоңыр', skills:['study','food','support'], times:['Бүгін','Ертең','Апта ішінде'], available:true, load:0, capacity:2, color:'#FBE1E4' },
  { id:'v6', name:'Темірлан', initials:'Т', area:'Есіл', skills:['delivery','food'], times:['Бүгін'], available:false, load:0, capacity:1, color:'#E7EDF0' },
];
export const initialRequests = [
  { id:'r101', title:'Азық-түлік әкелуге көмектесіңіздер', desc:'Үйге жақын дүкеннен азық-түлік әкелуге көмек қажет. Келісілген уақытта кездесуге болады.', category:'food', area:'Есіл', when:'Бүгін', urgency:'normal', owner:'Гүлнар апай (демо)', mine:false, status:'open', created: 1762080000000 },
  { id:'r102', title:'Математика сабағына қолдау керек', desc:'7-сынып математикасы бойынша бір сағаттық онлайн түсіндіру қажет.', category:'study', area:'Нұра', when:'Ертең', urgency:'normal', owner:'Аслан (демо)', mine:false, status:'open', created: 1762070000000 },
  { id:'r103', title:'Кітаптарды жеткізуге көмек', desc:'Қоғамдық кітап алмасу бұрышына бес кітап жеткізуге көмектесетін ерікті қажет.', category:'delivery', area:'Алматы', when:'Бүгін', urgency:'normal', owner:'Айдана (демо)', mine:false, status:'open', created: 1762060000000 },
  { id:'r104', title:'Сенбілікке еріктілер қажет', desc:'Аула тазалау және ағаш көшеттерін күту жұмысына қатысу үшін көмек керек.', category:'community', area:'Сарыарқа', when:'Апта ішінде', urgency:'normal', owner:'Қауымдастық (демо)', mine:false, status:'open', created: 1762050000000 },
];
export const defaultProfile = {
  name: 'Сіз (демо)', role: 'seeker', area: 'Есіл', available: true,
  skills: ['food','delivery','study','support','community'],
};
export const STATUS_LABELS = {
  open: 'Ашық', in_progress:'Орындалуда', awaiting_confirmation:'Растау қажет', completed:'Аяқталды'
};
