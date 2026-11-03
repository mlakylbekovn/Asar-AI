import React, { useEffect, useMemo, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, TextInput, StyleSheet, SafeAreaView,
  KeyboardAvoidingView, Platform, Modal, Alert, ActivityIndicator, StatusBar
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AREAS, CATEGORIES, TIMES, aStar, rankVolunteers, assignBatch, agentNextStep, suggestCategory, validPublicText, demandForecastFromRequests, estimateAcceptance, DEMAND_HMM } from './src/engine';
import { initialRequests, initialVolunteers, defaultProfile, STATUS_LABELS } from './src/data';

const C = {
  bg:'#F6F9F7', white:'#FFFFFF', text:'#15392F', muted:'#748981', green:'#117B60', deep:'#0A4F41',
  pale:'#EAF7EF', border:'#E7EFEA', amber:'#F6A73D', cream:'#FFF6E9', red:'#A9483F', softRed:'#FBEDEB',
};
const STORE_KEY = '@asar_ai_mobile_v1'; // backward-compatible saved local requests
const TABS = [
  { id:'home', icon:'⌂', label:'Басты' },
  { id:'explore', icon:'⌕', label:'Іздеу' },
  { id:'create', icon:'+', label:'Көмек сұрау' },
  { id:'activity', icon:'◷', label:'Тапсырмалар' },
  { id:'profile', icon:'☻', label:'Профиль' },
];
const percent = x => `${(x*100).toFixed(1)}%`;
const displayCategory = (id) => CATEGORIES.find(c => c.id === id) || CATEGORIES[0];
const getStatusColor = s => ({ open: C.green, in_progress:'#2874B4', awaiting_confirmation:'#A97017', completed:'#537269' }[s] || C.muted);
const initialForm = () => ({ title:'', desc:'', category:'food', area:'Есіл', when:'Бүгін', urgency:'normal' });

function Click({ children, onPress, style, disabled=false, accessibilityLabel }) {
  return <TouchableOpacity activeOpacity={0.8} disabled={disabled} accessibilityRole="button" accessibilityLabel={accessibilityLabel} onPress={onPress} style={[style, disabled && {opacity:0.55}]}>{children}</TouchableOpacity>;
}
function Btn({ label, onPress, ghost=false, light=false, onDark=false, small=false, disabled=false, style, icon }) {
  return <Click onPress={onPress} disabled={disabled} style={[s.btn, small && s.btnSmall, ghost ? s.btnOutline : light ? s.btnLight : s.btnSolid, style]}>
    {icon ? <Text style={[s.btnText, onDark ? {color:'#fff'} : ghost ? s.btnTextOutline : light ? s.btnTextLight : null]}>{icon}  </Text> : null}
    <Text style={[s.btnText, onDark ? {color:'#fff'} : ghost ? s.btnTextOutline : light ? s.btnTextLight : null, small && {fontSize:12}]}>{label}</Text>
  </Click>;
}
function Label({children}){ return <Text style={s.fieldLabel}>{children}</Text> }
function Chip({text, selected=false, onPress, emoji}){
  return <Click onPress={onPress} style={[s.chip,selected && s.chipActive]}><Text style={[s.chipTxt,selected && s.chipActiveTxt]}>{emoji ? `${emoji}  ` : ''}{text}</Text></Click>;
}
function StatusPill({status}){
  const clr = getStatusColor(status);
  return <View style={[s.statusPill,{backgroundColor: clr+'17'}]}><View style={[s.smallDot,{backgroundColor:clr}]}/><Text style={[s.statusPillTxt,{color:clr}]}>{STATUS_LABELS[status] || 'Ашық'}</Text></View>;
}
function Avatar({ name, bg='#E4F4E9', big=false }) {
  return <View style={[s.avatar, big && {width:52,height:52,borderRadius:18}, {backgroundColor:bg}]}><Text style={[s.avatarTxt,big && {fontSize:21}]}>{(name||'А')[0].toUpperCase()}</Text></View>;
}
function SectionTitle({label, action, onAction}){
  return <View style={s.sectionHead}><Text style={s.sectionTitle}>{label}</Text>{action?<Click onPress={onAction}><Text style={s.actionLink}>{action}  ›</Text></Click>:null}</View>;
}
function RequestCard({request, onPress, compact=false}) {
  const cat = displayCategory(request.category);
  return <Click onPress={onPress} style={s.requestCard} accessibilityLabel={`${request.title}, ${STATUS_LABELS[request.status]}`}>
    <View style={s.requestHeader}>
      <View style={[s.requestIcon,{backgroundColor:cat.soft}]}><Text style={{fontSize:23}}>{cat.emoji}</Text></View>
      <View style={{flex:1,gap:5}}><Text style={s.requestTitle} numberOfLines={2}>{request.title}</Text><Text style={s.requestOwner}>{request.owner}</Text></View>
      <Text style={{fontSize:20,color:C.muted}}>›</Text>
    </View>
    {!compact ? <Text style={s.requestDesc} numberOfLines={2}>{request.desc}</Text> : null}
    <View style={s.requestFooter}>
      <Text style={s.metaTxt}>⌖  {request.area}</Text>
      <Text style={s.metaTxt}>◷  {request.when}</Text>
      <StatusPill status={request.status}/>
    </View>
  </Click>;
}
function InfoRibbon(){return <View style={s.infoRibbon}><Text style={{fontSize:16}}>ⓘ</Text><Text style={s.infoText}>Демо-нұсқа: барлық өтініштер мен еріктілер — мысал. Нақты хабарлама жіберілмейді.</Text></View>}

export default function App(){
  const [hydrated,setHydrated] = useState(false);
  const [tab,setTab] = useState('home');
  const [profile,setProfile] = useState({...defaultProfile});
  const [requests,setRequests] = useState(initialRequests.map(r=>({...r})));
  const [volunteers,setVolunteers] = useState(initialVolunteers.map(v=>({...v})));
  const [filter,setFilter] = useState('all');
  const [search,setSearch] = useState('');
  const [form,setForm] = useState(initialForm());
  const [active,setActive] = useState(null);
  const [modal,setModal] = useState(null); // 'detail' | 'ai'
  const [suggested,setSuggested] = useState(null);
  const [demandScenario,setDemandScenario] = useState('normal');

  useEffect(()=>{
    (async()=>{
      try {
        const raw = await AsyncStorage.getItem(STORE_KEY);
        if(raw){const saved=JSON.parse(raw);
          if(Array.isArray(saved.requests)) setRequests(saved.requests);
          if(Array.isArray(saved.volunteers)) setVolunteers(saved.volunteers);
          if(saved.profile) setProfile(p=>({...p,...saved.profile}));
        }
      } catch(e){ console.warn('Демо деректерін оқу мүмкін болмады',e); }
      setHydrated(true);
    })();
  },[]);
  useEffect(()=>{
    if(!hydrated)return;
    AsyncStorage.setItem(STORE_KEY,JSON.stringify({requests,volunteers,profile})).catch(e=>console.warn('Сақтау қатесі',e));
  },[requests,volunteers,profile,hydrated]);

  const openCount=requests.filter(r=>r.status==='open').length;
  const completedCount=requests.filter(r=>r.status==='completed').length;
  const myRequests=requests.filter(r=>r.mine);
  const myTasks=requests.filter(r=>r.assignedTo==='demo-helper');
  const displayRequests=useMemo(()=>requests.filter(r=>(filter==='all'||r.category===filter)&&
    (r.title+' '+r.desc+' '+r.area).toLowerCase().includes(search.toLowerCase().trim())),[requests,filter,search]);
  const selected = requests.find(r=>r.id===active);
  const ranking=selected ? rankVolunteers(selected,volunteers):[];
  const batchAssignments=useMemo(()=>assignBatch(requests,volunteers),[requests,volunteers]);
  const batchChoice=selected ? batchAssignments.find(item=>item.requestId===selected.id):null;
  const plannedVolunteer=batchChoice?volunteers.find(v=>v.id===batchChoice.volunteerId):null;
  const agent=selected ? agentNextStep(selected,volunteers):null;

  function go(t){setTab(t);setSearch('');setFilter('all');setModal(null);}
  function openRequest(r){setActive(r.id);setModal('detail');}
  function showAI(r){setActive(r.id);setModal('ai');}
  function updateForm(name,val){setForm(f=>({...f,[name]:val}));}
  function setRole(role){setProfile(p=>({...p,role}));}
  function createRequest(){
    const title=form.title.trim(),desc=form.desc.trim();
    if(title.length<6 || desc.length<15){Alert.alert('Өтініш толық емес','Тақырыпты кемі 6, сипаттаманы кемі 15 таңбамен жазыңыз.');return;}
    if(!validPublicText(title+' '+desc)){Alert.alert('Құпия деректер','Телефон нөмірін, ЖСН, карта нөмірін және парольдерді өтінішке жазбаңыз.');return;}
    const item={...form,id:`r${Date.now()}`,title,desc,owner:'Сіз (демо)',mine:true,status:'open',created:Date.now()};
    setRequests(a=>[item,...a]);setProfile(p=>({...p,role:'seeker'}));setForm(initialForm());
    setActive(item.id);setTab('activity');setModal(null);
    Alert.alert('Өтініш қосылды!','«Тапсырмалар» бөлімінен AI арқылы еріктілерді қарап шығыңыз.');
  }
  function acceptRequest(req){
    if(req.status!=='open'){Alert.alert('Қолжетімсіз','Бұл өтінішті басқа ерікті қабылдаған.');return;}
    Alert.alert('Көмектесуге дайынсыз ба?', 'Бұл — тек жергілікті демо. Нақты адамға хабарлама жіберілмейді.',[
      {text:'Бас тарту',style:'cancel'},
      {text:'Қабылдау',onPress:()=>{
        setRequests(rs=>rs.map(r=>r.id===req.id?{...r,status:'in_progress',assignedTo:'demo-helper',assignedName:'Сіз (демо-ерікті)'}:r));
        setProfile(p=>({...p,role:'helper'}));setModal(null);setTab('activity');
      }}
    ]);
  }
  function markFinished(req){
    if(req.status!=='in_progress'||req.assignedTo!=='demo-helper')return;
    setRequests(rs=>rs.map(r=>r.id===req.id?{...r,status:'awaiting_confirmation'}:r));
    Alert.alert('Орындалды деп белгіленді','Енді өтініш иесі көмекті растауы керек.');
  }
  function confirmRequest(req){
    if(!req.mine||req.status!=='awaiting_confirmation')return;
    setRequests(rs=>rs.map(r=>r.id===req.id?{...r,status:'completed'}:r));
    Alert.alert('Көмек расталды','ASAR AI — бірге көмектесеміз!');
  }
  function recommendVolunteer(req,v){
    if(!rankVolunteers(req,volunteers).some(x=>x.id===v.id))return;
    setRequests(rs=>rs.map(r=>r.id===req.id?{...r,suggestedVolunteerId:v.id}:r));
    setSuggested(v.name);
    Alert.alert('Ұсыныс сақталды',`${v.name} осы өтінішке ұсынылды (демо). Нақты хабарлама жіберілген жоқ.`);
  }
  function resetDemo(){
    Alert.alert('Демоны қайта бастау','Жасалған өтініштер мен өзгерістер өшіріледі. Жалғастырасыз ба?',[
      {text:'Жоқ',style:'cancel'}, {text:'Иә, тазалау',style:'destructive',onPress:()=>{
        setRequests(initialRequests.map(r=>({...r})));setVolunteers(initialVolunteers.map(v=>({...v})));
        setProfile({...defaultProfile});setTab('home');setModal(null);
      }}
    ]);
  }
  const featured=requests.filter(r=>r.status==='open').slice(0,3);
  const demand=useMemo(()=>demandForecastFromRequests(requests,demandScenario),[requests,demandScenario]);
  const bayesRequest=requests.find(r=>r.status==='open');
  const bayesExample=bayesRequest ? rankVolunteers(bayesRequest,volunteers)[0] : null;

  if(!hydrated)return <View style={[s.shell,{justifyContent:'center',alignItems:'center'}]}><ActivityIndicator size="large" color={C.green}/><Text style={{marginTop:15,color:C.muted}}>ASAR AI жүктелуде...</Text></View>;

  return <SafeAreaView style={s.shell}>
    <StatusBar barStyle="dark-content" backgroundColor={C.bg}/>
    <KeyboardAvoidingView style={{flex:1}} behavior={Platform.OS==='ios'?'padding':undefined}>
      <View style={s.topbar}>
        <View><Text style={s.brandSmall}>ASAR <Text style={{color:C.green}}>AI</Text>  <Text style={s.demoLabel}>DEMO</Text></Text><Text style={s.location}>⌖  Астана, Қазақстан</Text></View>
        <Click onPress={()=>go('profile')} style={s.topAvatar}><Text style={{fontSize:20}}>☻</Text></Click>
      </View>
      <View style={{flex:1}}>
        <ScrollView key={tab} contentContainerStyle={s.screen} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          {tab==='home' && <>
            <View style={s.hero}>
              <View style={s.decorA}/><View style={s.decorB}/>
              <Text style={s.heroEyebrow}>ҚОЛ ҰШЫН БІРГЕ СОЗАЙЫҚ</Text>
              <Text style={s.heroTitle}>Жақсылыққа{ '\n' }бір қадам. <Text style={{color:'#B9F3CC'}}>♡</Text></Text>
              <Text style={s.heroSub}>Көмек сұраңыз немесе айналаңыздағы адамдарға қолдау көрсетіңіз.</Text>
              <View style={s.heroBtns}><Btn label="Көмек сұрау" onPress={()=>go('create')} light icon="＋"/><Btn label="Көмектесу" onPress={()=>go('explore')} ghost onDark style={{borderColor:'#8DD2B9',backgroundColor:'#FFFFFF12'}}/></View>
              <Text style={s.heroFlower}>✳</Text>
            </View>
            <InfoRibbon/>
            <View style={s.statsRow}>
              <View style={s.statBox}><Text style={s.statNum}>{openCount}</Text><Text style={s.statLabel}>Ашық өтініш</Text></View>
              <View style={s.statBox}><Text style={s.statNum}>{volunteers.filter(v=>v.available).length}</Text><Text style={s.statLabel}>Ерікті (демо)</Text></View>
              <View style={s.statBox}><Text style={s.statNum}>{completedCount}</Text><Text style={s.statLabel}>Расталған</Text></View>
            </View>
            <SectionTitle label="Қалай жұмыс істейді?"/>
            <View style={s.howRow}>
              {[['✍️','Өтініш','Сұраныс қосу'],['🧠','AI таңдайды','Сәйкестендіру'],['🤝','Көмек','Қабылдау және растау']].map(x=><View key={x[1]} style={s.howItem}><View style={s.howIcon}><Text style={{fontSize:22}}>{x[0]}</Text></View><Text style={s.howName}>{x[1]}</Text><Text style={s.howDesc}>{x[2]}</Text></View>)}
            </View>
            <Click onPress={()=>go('analytics')} style={s.analyticsBanner} accessibilityLabel="Bayesian және HMM талдауын ашу">
              <View style={{flex:1}}><Text style={s.analyticsTag}>ЖАҢА • 6 + 7 АПТА</Text><Text style={s.analyticsTitle}>AI аналитика: Bayesian + HMM</Text><Text style={s.analyticsBody}>HMM болжамы: {demand.nextState.toLowerCase()} жүктеме. Байес ұсынысты қабылдау ықтималдығын есептейді.</Text></View><Text style={{fontSize:26,color:C.green}}>↗</Text>
            </Click>
            <SectionTitle label="Жаңа өтініштер" action="Барлығы" onAction={()=>go('explore')}/>
            {featured.length?featured.map(r=><RequestCard key={r.id} request={r} onPress={()=>openRequest(r)} compact/>):<Text style={s.mutedCenter}>Әзірше ашық өтініш жоқ</Text>}
            <View style={s.aiBanner}><Text style={{fontSize:25}}>✨</Text><View style={{flex:1}}><Text style={s.aiBannerTitle}>AI ақылды сәйкестендіру</Text><Text style={s.aiBannerText}>Еріктілерді дағдысы, уақыты және шартты маршрут бойынша салыстырады.</Text></View></View>
          </>}

          {tab==='explore' && <>
            <Text style={s.pageTitle}>Көмек сұраулары</Text><Text style={s.pageSub}>Айналаңыздағы адамдарға қолдау көрсетіңіз.</Text>
            <View style={s.searchBar}><Text style={{fontSize:20,color:C.muted}}>⌕</Text><TextInput value={search} onChangeText={setSearch} placeholder="Өтініштерді іздеу..." placeholderTextColor="#9AADA4" style={s.searchInput}/>{search?<Click onPress={()=>setSearch('')}><Text style={{color:C.muted,fontSize:19}}>×</Text></Click>:null}</View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{marginBottom:17}} contentContainerStyle={{gap:8,paddingRight:14}}>
              <Chip text="Барлығы" selected={filter==='all'} onPress={()=>setFilter('all')}/>
              {CATEGORIES.map(x=><Chip key={x.id} text={x.label} emoji={x.emoji} selected={filter===x.id} onPress={()=>setFilter(x.id)}/>)}
            </ScrollView>
            <Text style={s.resultTxt}>{displayRequests.length} өтініш табылды</Text>
            {displayRequests.length?displayRequests.map(r=><RequestCard key={r.id} request={r} onPress={()=>openRequest(r)}/>):<View style={s.empty}><Text style={{fontSize:34}}>🔎</Text><Text style={s.emptyTitle}>Өтініш табылмады</Text><Text style={s.emptyDesc}>Іздеу сөзін немесе сүзгіні өзгертіңіз.</Text></View>}
          </>}

          {tab==='create' && <>
            <Text style={s.pageTitle}>Көмек сұрау</Text><Text style={s.pageSub}>Өтінішіңізді толтырыңыз — AI сәйкес еріктілерді ұсынады.</Text>
            <View style={s.formCard}>
              <Label>Қандай көмек қажет?</Label>
              <TextInput style={s.input} value={form.title} onChangeText={v=>updateForm('title',v)} maxLength={85} placeholder="Мысалы: Азық-түлік әкелуге көмек" placeholderTextColor="#A1AEA8"/>
              <Label>Толық сипаттама</Label>
              <TextInput style={[s.input,s.textArea]} value={form.desc} onChangeText={v=>{
                updateForm('desc',v);
              }} multiline textAlignVertical="top" maxLength={550} placeholder="Қай уақытта, қандай көмек қажет екенін жазыңыз..." placeholderTextColor="#A1AEA8"/>
              <View style={s.suggestion}><Text style={s.suggestionText}>✦  Мәтіннен санат ұсыну (қарапайым ережелер, ML емес)</Text>{suggestCategory(form.desc) ? <Click onPress={()=>updateForm('category',suggestCategory(form.desc))}><Text style={[s.suggestionText,{color:C.green,fontWeight:'800',marginTop:7}]}>Ұсыныс: {displayCategory(suggestCategory(form.desc)).label} · қолдану ›</Text></Click> : null}</View>
              <Label>Көмек санаты</Label>
              <View style={s.categoriesWrap}>{CATEGORIES.map(cat=><Click key={cat.id} onPress={()=>updateForm('category',cat.id)} style={[s.catChoice,form.category===cat.id&&s.catChoiceActive]}><Text style={{fontSize:19}}>{cat.emoji}</Text><Text style={[s.catChoiceTxt,form.category===cat.id && {color:C.green}]}>{cat.label}</Text>{form.category===cat.id&&<Text style={{color:C.green}}>✓</Text>}</Click>)}</View>
              <Label>Қала ауданы</Label><View style={s.chipWrap}>{AREAS.map(a=><Chip key={a} text={a} selected={form.area===a} onPress={()=>updateForm('area',a)}/>)}</View>
              <Label>Қай уақытқа керек?</Label><View style={s.chipWrap}>{TIMES.map(t=><Chip key={t} text={t} selected={form.when===t} onPress={()=>updateForm('when',t)}/>)}</View>
              <View style={s.privacyNotice}><Text style={s.privacyText}>🔒  Қауіпсіздік үшін телефон, нақты мекенжай, ЖСН, карта деректерін және пароль жазбаңыз. Бұл демода өтініш тек осы телефонда сақталады.</Text></View>
              <Btn label="Өтініш жариялау" icon="＋" onPress={createRequest} style={{marginTop:17}}/>
            </View>
          </>}

          {tab==='activity' && <>
            <Text style={s.pageTitle}>Менің тапсырмаларым</Text><Text style={s.pageSub}>Өтініштер мен көрсетілген көмектің барысы.</Text>
            <View style={s.roleSwitch}>
              <Click style={[s.roleOpt,profile.role==='seeker'&&s.roleOptActive]} onPress={()=>setRole('seeker')}><Text style={[s.roleTxt,profile.role==='seeker'&&s.roleTxtActive]}>🙋 Көмек сұраушы</Text></Click>
              <Click style={[s.roleOpt,profile.role==='helper'&&s.roleOptActive]} onPress={()=>setRole('helper')}><Text style={[s.roleTxt,profile.role==='helper'&&s.roleTxtActive]}>🤝 Ерікті</Text></Click>
            </View>
            {profile.role==='seeker' ? <>
              <Text style={s.resultTxt}>Менің өтініштерім · {myRequests.length}</Text>
              {myRequests.length ? myRequests.map(r=><View key={r.id} style={{marginBottom:12}}>
                <RequestCard request={r} onPress={()=>openRequest(r)} compact/>
                {r.status==='open' ? <Btn small label="AI арқылы ерікті табу" icon="✦" onPress={()=>showAI(r)} style={{marginTop:8}}/>:null}
                {r.status==='awaiting_confirmation'?<Btn small label="Көмекті растау ✓" onPress={()=>confirmRequest(r)} style={{marginTop:8}}/>:null}
              </View>) : <View style={s.empty}><Text style={{fontSize:35}}>📝</Text><Text style={s.emptyTitle}>Әзірше өтініш жоқ</Text><Text style={s.emptyDesc}>Көмек сұрау формасын толтырып көріңіз.</Text><Btn label="Көмек сұрау" onPress={()=>go('create')} small style={{marginTop:15}}/></View>}
            </> : <>
              <Text style={s.resultTxt}>Қабылдаған тапсырмалар · {myTasks.length}</Text>
              {myTasks.length ? myTasks.map(r=><View key={r.id} style={{marginBottom:12}}>
                <RequestCard request={r} onPress={()=>openRequest(r)} compact/>
                {r.status==='in_progress'?<Btn small label="Көмек көрсетілді" onPress={()=>markFinished(r)} style={{marginTop:8}}/>:null}
                {r.status==='awaiting_confirmation'?<View style={s.suggestion}><Text style={s.suggestionText}>Өтініш иесінің растауы күтілуде</Text></View>:null}
              </View>) : <View style={s.empty}><Text style={{fontSize:35}}>🙌</Text><Text style={s.emptyTitle}>Қабылданған тапсырма жоқ</Text><Text style={s.emptyDesc}>«Іздеу» бөліміне өтіп, көмек көрсетіңіз.</Text><Btn label="Өтініштерді қарау" onPress={()=>go('explore')} small style={{marginTop:15}}/></View>}
            </>}
            <View style={s.suggestion}><Text style={s.suggestionText}>Рөл ауыстыру тек демонстрация үшін: нақты аккаунт тексеруі әлі қосылмаған.</Text></View>
          </>}

          {tab==='analytics' && <>
            <Btn label="← Басты бетке" ghost small onPress={()=>go('home')} style={{alignSelf:'flex-start',marginBottom:16}}/>
            <Text style={s.pageTitle}>AI аналитикасы</Text>
            <Text style={s.pageSub}>6-апта: Bayesian Network • 7-апта: Hidden Markov Model. Барлық ықтималдықтар — оқу мақсатындағы модельдік есеп.</Text>
            <View style={s.formCard}>
              <Text style={s.analyticsHeading}>🧭 HMM · Сұраныс қарқыны</Text>
              <Text style={s.analyticsHelp}>Алдыңғы 6 кезеңдегі ашық өтініштер — жасанды мысал. Соңғы мән телефондағы қазіргі ашық өтініштер саны.</Text>
              <Label>Сұраныс сценарийі</Label>
              <View style={s.chipWrap}>
                {[["quiet","Тыныш"],["normal","Қалыпты"],["busy","Көп сұраныс"]].map(([key,name])=><Chip key={key} text={name} selected={demandScenario===key} onPress={()=>setDemandScenario(key)}/>)}
              </View>
              <Text style={s.analyticsHelp}>Бақылаулар: {demand.counts.join(' → ')} өтініш</Text>
              <Text style={s.analyticsHelp}>Санаттар: {demand.observationLabels.join(' → ')}</Text>
              <View style={s.analyticsResult}><Text style={s.analyticsResultLabel}>Қазір бағаланған жасырын күй</Text><Text style={s.analyticsResultMain}>{demand.currentState}</Text><Text style={s.analyticsResultLabel}>Келесі кезеңдегі ең ықтимал күй: {demand.nextState}</Text></View>
              <Text style={s.analyticsHeading}>Келесі кезеңнің ықтималдықтары</Text>
              {DEMAND_HMM.states.map((name,i)=><View key={name} style={s.progressRow}><View style={s.progressHead}><Text style={s.progressTxt}>{name}</Text><Text style={s.progressTxt}>{percent(demand.nextProbabilities[i])}</Text></View><View style={s.progressTrack}><View style={[s.progressFill,{width:`${Math.round(demand.nextProbabilities[i]*100)}%`,backgroundColor:[C.green,'#D59D40',C.red][i]}]}/></View></View>)}
              <Text style={s.analyticsHelp}>Viterbi бойынша жасырын күйлер: {demand.viterbiPath.join(' → ')}</Text>
              <Text style={s.analyticsFoot}>HMM: initial + transition + emission матрицалары, Forward фильтрациясы және Viterbi. Бұл нақты жиналған тарихи статистика емес.</Text>
            </View>
            <View style={s.formCard}>
              <Text style={s.analyticsHeading}>🎯 Bayesian · Еріктіні бағалау</Text>
              <Text style={s.analyticsHelp}>Үш белгі бойынша есеп: маршрут жақын ба, еріктінің жүктемесі төмен бе, тапсырма бүгін бе?</Text>
              {bayesExample && bayesRequest ? <>
                <Text style={s.analyticsHelp}>Өтініш: {bayesRequest.title}</Text>
                <View style={s.analyticsResult}><Text style={s.analyticsResultLabel}>Ұсынылған ерікті: {bayesExample.name}</Text><Text style={s.analyticsResultMain}>{percent(bayesExample.bayes.probability)}</Text><Text style={s.analyticsResultLabel}>Байес моделіндегі қабылдау ықтималдығы (демо)</Text></View>
                {bayesExample.bayes.evidence.map(e=><View key={e.key} style={s.explainRow}><Text style={s.explainLabel}>{e.label}</Text><Text style={s.explainValue}>{e.value?'ИӘ':'ЖОҚ'}</Text></View>)}
                <Btn label="Басқа еріктілерді салыстыру" ghost small onPress={()=>showAI(bayesRequest)} style={{marginTop:12}}/>
              </> : <Text style={s.analyticsHelp}>Ашық өтінішке сәйкес ерікті табылмады. Жаңа өтініш құрып көріңіз.</Text>}
              <Text style={s.analyticsFoot}>P(A|E) = P(A) × P(E|A) / P(E). Бастапқы P(A)=45%; шартты ықтималдықтар — оқытуға арналған жорамал, адамдардың нақты жауап статистикасы емес.</Text>
            </View>
          </>}

          {tab==='profile' && <>
            <Text style={s.pageTitle}>Менің профилім</Text><Text style={s.pageSub}>Қолжетімділік пен көмектесу мүмкіндіктері.</Text>
            <View style={s.profileCard}><Avatar name="С" big/><View style={{flex:1}}><Text style={s.profileName}>Сіз (демо)</Text><Text style={s.profileSub}>ASAR AI қолданушысы</Text></View><View style={s.memberBadge}><Text style={{fontSize:11,color:C.green,fontWeight:'800'}}>DEMO</Text></View></View>
            <View style={s.formCard}>
              <Label>Рөл</Label>
              <View style={s.roleSwitch}><Click style={[s.roleOpt,profile.role==='seeker'&&s.roleOptActive]} onPress={()=>setRole('seeker')}><Text style={[s.roleTxt,profile.role==='seeker'&&s.roleTxtActive]}>Көмек сұраушы</Text></Click><Click style={[s.roleOpt,profile.role==='helper'&&s.roleOptActive]} onPress={()=>setRole('helper')}><Text style={[s.roleTxt,profile.role==='helper'&&s.roleTxtActive]}>Ерікті</Text></Click></View>
              <Label>Менің ауданым</Label><View style={s.chipWrap}>{AREAS.map(a=><Chip key={a} text={a} selected={profile.area===a} onPress={()=>setProfile(p=>({...p,area:a}))}/>)}</View>
              <Label>Көмектесе алатын бағыттар</Label><View style={s.categoriesWrap}>{CATEGORIES.map(cat=><Click key={cat.id} style={[s.catChoice,profile.skills.includes(cat.id)&&s.catChoiceActive]} onPress={()=>setProfile(p=>({...p,skills:p.skills.includes(cat.id)?p.skills.filter(x=>x!==cat.id):[...p.skills,cat.id]}))}><Text style={{fontSize:18}}>{cat.emoji}</Text><Text style={s.catChoiceTxt}>{cat.label}</Text><Text style={{color:profile.skills.includes(cat.id)?C.green:C.muted}}>{profile.skills.includes(cat.id)?'✓':'＋'}</Text></Click>)}</View>
              <Click onPress={()=>setProfile(p=>({...p,available:!p.available}))} style={s.toggleRow}><View><Text style={s.toggleTitle}>Көмек көрсетуге дайынмын</Text><Text style={s.toggleDesc}>{profile.available?'Қолжетімді':'Уақытша қолжетімсіз'}</Text></View><View style={[s.fakeToggle,profile.available&&s.fakeToggleOn]}><View style={[s.toggleKnob,profile.available&&{marginLeft:19}]}/></View></Click>
            </View>
            <SectionTitle label="AI модульдері"/>
            <View style={s.formCard}>
              {[['Intelligent Agent','Іске асқан'],['A* Search','Іске асқан'],['CSP / сәйкестендіру','Іске асқан'],['Bayesian inference','Іске асқан'],['HMM / Forward + Viterbi','Іске асқан'],['Minimax · Q-learning','Жоспарда'],['ML · Neural Net · LLM','Жоспарда']].map((x,i)=><View key={x[0]} style={[s.aiModuleRow,i>0&&{borderTopWidth:1,borderColor:C.border}]}><Text style={{flex:1,fontSize:12.5,color:C.text,fontWeight:'600'}}>{x[0]}</Text><Text style={{fontSize:11,color:i<5?C.green:'#A87939'}}>{x[1]}</Text></View>)}
              <Btn label="Bayesian және HMM нәтижелерін көру" ghost small onPress={()=>go('analytics')} style={{marginTop:14}}/>
            </View>
            <Click onPress={resetDemo} style={s.resetBtn}><Text style={{fontSize:13,color:C.red,fontWeight:'700'}}>↻  Демо деректерін қайта бастау</Text></Click>
            <Text style={s.disclaimer}>ASAR AI MVP 1.1 · 5 AI тақырыбы · Оқу прототипі. Нақты адамдар, SMS, төлем, шұғыл көмек және қоғамдық сервер қосылмаған. Төтенше жағдайда 112 нөміріне хабарласыңыз.</Text>
          </>}
        </ScrollView>
      </View>
      <View style={s.navBar}>{TABS.map(t=><Click key={t.id} onPress={()=>go(t.id)} style={[s.navItem,tab===t.id&&s.navItemActive]} accessibilityLabel={t.label}>
        <View style={[s.navIconWrap,t.id==='create'&&s.navIconPlus]}><Text style={[s.navIcon,tab===t.id&&{color:C.green},t.id==='create'&&{color:'#FFF',fontSize:27}]}>{t.icon}</Text></View>
        <Text style={[s.navText,tab===t.id&&{color:C.green,fontWeight:'800'}]}>{t.label}</Text>
      </Click>)}</View>
    </KeyboardAvoidingView>

    <Modal transparent visible={!!modal} animationType="slide" onRequestClose={()=>setModal(null)}>
      <View style={s.modalBackdrop}><Click onPress={()=>setModal(null)} style={{flex:1}}/><View style={s.modalSheet}>
        <View style={s.modalHandle}/><View style={s.modalHeader}><Text style={s.modalTitle}>{modal==='ai'?'✦  AI сәйкестендіру':'Өтініш туралы'}</Text><Click onPress={()=>setModal(null)} style={s.closeBtn}><Text style={{fontSize:21,color:C.muted}}>×</Text></Click></View>
        {selected ? <ScrollView style={{maxHeight:570}} contentContainerStyle={{paddingBottom:20}} showsVerticalScrollIndicator={false}>
          {modal==='detail'? <>
            <StatusPill status={selected.status}/><Text style={[s.pageTitle,{fontSize:21,marginTop:12}]}>{selected.title}</Text>
            <Text style={[s.requestDesc,{fontSize:14,marginTop:10,marginBottom:18}]}>{selected.desc}</Text>
            <View style={s.modalInfo}><Text style={s.modalLine}>🗂  {displayCategory(selected.category).label}</Text><Text style={s.modalLine}>⌖  {selected.area} ауданы</Text><Text style={s.modalLine}>◷  {selected.when}</Text><Text style={s.modalLine}>👤  {selected.owner}</Text></View>
            {selected.suggestedVolunteerId&&<Text style={s.suggestionText}>✦  Ұсынылған ерікті: {volunteers.find(v=>v.id===selected.suggestedVolunteerId)?.name||'Ерікті'}</Text>}
            {selected.status==='open'&&<Btn label="Көмектесемін" icon="♡" onPress={()=>acceptRequest(selected)} style={{marginTop:14}}/>}
            {selected.status==='open'&&<Btn label="AI еріктілерді ұсынсын" ghost onPress={()=>setModal('ai')} style={{marginTop:9}}/>}
            {selected.status==='in_progress'&&selected.assignedTo==='demo-helper'&&<Btn label="Көмек көрсетілді" onPress={()=>{setModal(null);markFinished(selected)}} style={{marginTop:14}}/>}
            {selected.status==='awaiting_confirmation'&&selected.mine&&<Btn label="Көмекті растау" onPress={()=>{setModal(null);confirmRequest(selected)}} style={{marginTop:14}}/>}
          </> : <>
            <View style={s.aiExplain}><Text style={{fontSize:17,fontWeight:'800',color:C.deep}}>Агент шешімі: {agent.action}</Text><Text style={{fontSize:12.5,color:C.muted,marginTop:4}}>{agent.reason}</Text><Text style={{fontSize:11.5,color:C.muted,marginTop:5}}>A* маршрут + CSP шектеулері + Bayesian ықтималдық</Text><Text style={{fontSize:11.5,color:C.deep,marginTop:8,fontWeight:'700'}}>CSP жалпы жоспар: {plannedVolunteer ? plannedVolunteer.name : 'Бұл өтінішке қолжетімді ерікті бөлінбеді'}</Text></View>
            <Text style={{fontWeight:'800',fontSize:15,color:C.text,marginVertical:12}}>{ranking.length} сәйкес ерікті</Text>
            {ranking.length?ranking.map((v,i)=><View key={v.id} style={s.volunteerRow}>
              <View style={{flexDirection:'row',alignItems:'center',gap:11}}><Avatar name={v.name} bg={v.color}/><View style={{flex:1}}><Text style={s.volName}>{i+1}. {v.name}</Text><Text style={s.volMeta}>⌖  {v.area} · {v.route?.cost ?? '—'} шартты бірлік</Text></View><View style={s.score}><Text style={s.scoreText}>{v.score}</Text><Text style={s.scoreSub}>балл</Text></View></View>
              <Text style={s.routeText}>Маршрут: {v.route?.path.join(' → ') || 'есептелмеді'}</Text>
              <View style={s.bayesBadge}><Text style={s.bayesBadgeText}>⑥ Байес болжамы: {percent(v.bayes.probability)} · қабылдау ықтималдығы (демо)</Text></View>
              <Text style={[s.routeText,{fontSize:10}]}>Белгілер: жақын {v.bayes.observed.nearby?'✓':'×'} · жүктемесі төмен {v.bayes.observed.lowLoad?'✓':'×'} · бүгін {v.bayes.observed.today?'✓':'×'}</Text>
              <Btn small label={selected.suggestedVolunteerId===v.id?'Ұсынылды ✓':'Осы еріктіні ұсыну'} onPress={()=>recommendVolunteer(selected,v)} disabled={selected.suggestedVolunteerId===v.id||selected.status!=='open'} style={{marginTop:9}}/>
            </View>):<Text style={s.emptyDesc}>Сәйкес ерікті табылмады. Уақытты немесе көмек санатын өзгертіп көріңіз.</Text>}
            <Text style={s.disclaimer}>Есептегі маршрут — шартты аудан графы, нақты жол немесе километр емес. Сәйкестік баллы ML ықтималдығы емес; Bayesian CPT — жасанды болжам. Ерікті автоматты бекітілмейді.</Text>
          </>}
        </ScrollView> : <Text style={s.emptyDesc}>Өтініш табылмады.</Text>}
      </View></View>
    </Modal>
  </SafeAreaView>;
}

const s=StyleSheet.create({
  shell:{flex:1,backgroundColor:C.bg},
  topbar:{height:67,backgroundColor:C.bg,paddingHorizontal:20,flexDirection:'row',justifyContent:'space-between',alignItems:'center',borderBottomWidth:1,borderBottomColor:C.border},
  brandSmall:{fontSize:23,color:C.deep,fontWeight:'900',letterSpacing:-0.7},demoLabel:{fontSize:10,color:C.muted,fontWeight:'800',letterSpacing:1},
  location:{fontSize:11,color:C.muted,marginTop:2},topAvatar:{height:42,width:42,borderRadius:16,backgroundColor:'#E3F3E9',alignItems:'center',justifyContent:'center'},
  screen:{paddingHorizontal:18,paddingTop:20,paddingBottom:38},
  hero:{backgroundColor:C.deep,borderRadius:25,padding:23,paddingBottom:26,minHeight:235,overflow:'hidden',marginBottom:15},
  decorA:{position:'absolute',width:178,height:178,borderRadius:90,borderWidth:1,borderColor:'#FFFFFF24',top:-85,right:-40},
  decorB:{position:'absolute',width:230,height:230,borderRadius:120,borderWidth:1,borderColor:'#FFFFFF16',top:-105,right:-67},
  heroEyebrow:{fontSize:10,fontWeight:'900',letterSpacing:1.5,color:'#B3E4CB'},
  heroTitle:{fontSize:29,fontWeight:'900',lineHeight:35,letterSpacing:-0.9,color:'white',marginTop:13},
  heroSub:{fontSize:12.5,color:'#C9E9DA',marginTop:9,maxWidth:'92%',lineHeight:20},
  heroBtns:{flexDirection:'row',gap:9,marginTop:18,flexWrap:'wrap'},
  heroFlower:{position:'absolute',right:20,bottom:44,fontSize:62,color:'#FFFFFF11'},
  btn:{minHeight:46,borderRadius:13,justifyContent:'center',alignItems:'center',flexDirection:'row',paddingHorizontal:17},
  btnSolid:{backgroundColor:C.green},btnOutline:{borderColor:'#C6E3D5',borderWidth:1.2,backgroundColor:C.white},btnLight:{backgroundColor:'#E7F5ED'},
  btnSmall:{minHeight:39,borderRadius:10,paddingHorizontal:13},btnText:{color:'#fff',fontSize:13,fontWeight:'800'},btnTextOutline:{color:C.green},btnTextLight:{color:C.deep},
  infoRibbon:{backgroundColor:C.cream,borderRadius:11,padding:12,marginBottom:16,flexDirection:'row',alignItems:'center',gap:9},
  infoText:{fontSize:11,color:'#9A7137',lineHeight:16,flex:1},
  statsRow:{flexDirection:'row',gap:9,marginBottom:23},statBox:{backgroundColor:C.white,borderRadius:16,borderColor:C.border,borderWidth:1,paddingVertical:16,flex:1,alignItems:'center'},
  statNum:{fontSize:23,fontWeight:'900',color:C.deep},statLabel:{fontSize:10.5,color:C.muted,marginTop:5,fontWeight:'600'},
  sectionHead:{flexDirection:'row',justifyContent:'space-between',alignItems:'center',marginBottom:12,marginTop:6},sectionTitle:{fontSize:17,fontWeight:'800',color:C.text,letterSpacing:-0.4},actionLink:{fontSize:12,fontWeight:'800',color:C.green},
  howRow:{flexDirection:'row',gap:9,marginBottom:21},howItem:{flex:1,alignItems:'center',backgroundColor:C.white,borderRadius:14,borderWidth:1,borderColor:C.border,paddingVertical:15,paddingHorizontal:5},
  howIcon:{width:42,height:42,borderRadius:15,backgroundColor:C.pale,justifyContent:'center',alignItems:'center',marginBottom:9},howName:{fontSize:11,fontWeight:'800',color:C.text},howDesc:{fontSize:9.7,color:C.muted,textAlign:'center',marginTop:4},
  requestCard:{backgroundColor:C.white,borderColor:C.border,borderWidth:1,borderRadius:19,padding:15,marginBottom:11},
  requestHeader:{flexDirection:'row',alignItems:'center',gap:11},requestIcon:{width:47,height:47,borderRadius:16,alignItems:'center',justifyContent:'center'},
  requestTitle:{fontSize:14,fontWeight:'800',color:C.text,lineHeight:20},requestOwner:{fontSize:11,color:C.muted},requestDesc:{color:'#5E716B',fontSize:12.3,lineHeight:19,marginTop:12},
  requestFooter:{flexDirection:'row',gap:11,alignItems:'center',marginTop:13,flexWrap:'wrap'},metaTxt:{fontSize:10.7,color:C.muted},
  statusPill:{flexDirection:'row',alignItems:'center',gap:5,alignSelf:'flex-start',paddingHorizontal:9,paddingVertical:5,borderRadius:25,marginLeft:'auto'},smallDot:{width:5,height:5,borderRadius:5},statusPillTxt:{fontSize:10,fontWeight:'800'},
  analyticsBanner:{marginBottom:19,backgroundColor:'#E8F5ED',borderRadius:17,borderColor:'#CBE6D5',borderWidth:1,padding:16,flexDirection:'row',alignItems:'center',gap:12},
  analyticsTag:{color:C.green,fontSize:10,fontWeight:'900',letterSpacing:1.1},
  analyticsTitle:{color:C.deep,fontSize:15,fontWeight:'900',marginTop:5},
  analyticsBody:{color:'#658377',fontSize:11.3,lineHeight:17,marginTop:7},
  analyticsHeading:{fontSize:16,fontWeight:'900',color:C.deep,marginBottom:9,marginTop:3},
  analyticsHelp:{fontSize:11.5,lineHeight:18,color:C.muted,marginBottom:12},
  analyticsResult:{borderRadius:13,padding:16,backgroundColor:C.pale,marginBottom:15},
  analyticsResultLabel:{fontSize:11,color:C.green,fontWeight:'700'},
  analyticsResultMain:{fontSize:28,fontWeight:'900',color:C.deep,marginVertical:7},
  analyticsFoot:{fontSize:10.4,lineHeight:17,color:'#8B9D94',marginTop:14},
  progressRow:{marginBottom:12},progressHead:{flexDirection:'row',justifyContent:'space-between',marginBottom:6},progressTxt:{fontSize:11.8,fontWeight:'700',color:C.text},
  progressTrack:{backgroundColor:'#E5EEE7',height:10,borderRadius:10,overflow:'hidden'},progressFill:{height:10,borderRadius:10},
  explainRow:{paddingVertical:9,flexDirection:'row',justifyContent:'space-between',gap:10,borderBottomWidth:1,borderColor:C.border},
  explainLabel:{fontSize:11.5,color:C.text,flex:1},explainValue:{fontWeight:'900',fontSize:11.5,color:C.green},
  bayesBadge:{backgroundColor:'#E7F4EC',padding:9,borderRadius:9,marginTop:9},bayesBadgeText:{color:C.green,fontSize:10.8,fontWeight:'800'},
  aiBanner:{marginTop:14,borderRadius:17,padding:15,backgroundColor:'#E9F5EF',flexDirection:'row',alignItems:'center',gap:12},aiBannerTitle:{fontWeight:'800',fontSize:13,color:C.deep},aiBannerText:{fontSize:11,color:'#5E8B77',lineHeight:17,marginTop:4},
  pageTitle:{color:C.text,fontSize:25,fontWeight:'900',letterSpacing:-0.7},pageSub:{color:C.muted,fontSize:12.5,lineHeight:19,marginTop:5,marginBottom:20},
  searchBar:{borderWidth:1,borderColor:C.border,backgroundColor:C.white,borderRadius:13,paddingHorizontal:13,flexDirection:'row',alignItems:'center',minHeight:47,marginBottom:14,gap:10},searchInput:{flex:1,color:C.text,fontSize:13,paddingVertical:8},
  chip:{borderWidth:1,borderColor:'#DDE9E1',backgroundColor:C.white,paddingHorizontal:12,paddingVertical:10,borderRadius:25},chipActive:{borderColor:C.green,backgroundColor:C.pale},chipTxt:{fontSize:12,color:'#687F75',fontWeight:'600'},chipActiveTxt:{color:C.green,fontWeight:'800'},
  resultTxt:{fontSize:11.5,color:C.muted,fontWeight:'700',marginBottom:12},empty:{marginTop:20,padding:29,alignItems:'center',backgroundColor:C.white,borderRadius:17,borderWidth:1,borderColor:C.border},emptyTitle:{fontSize:16,fontWeight:'800',color:C.text,marginTop:11},emptyDesc:{fontSize:12,color:C.muted,lineHeight:19,marginTop:6,textAlign:'center'},mutedCenter:{fontSize:13,color:C.muted,textAlign:'center',padding:20},
  formCard:{backgroundColor:C.white,borderRadius:20,borderColor:C.border,borderWidth:1,padding:17,marginBottom:14},fieldLabel:{fontSize:12,color:C.text,fontWeight:'800',marginBottom:9,marginTop:8},
  input:{borderWidth:1,borderColor:'#DFE8E2',borderRadius:12,paddingHorizontal:13,paddingVertical:13,fontSize:13,color:C.text,backgroundColor:'#FCFEFD',marginBottom:13},textArea:{height:114},
  suggestion:{borderRadius:10,backgroundColor:'#F1F9F4',padding:12,marginBottom:14},suggestionText:{fontSize:11,color:'#478069',lineHeight:18},
  categoriesWrap:{flexDirection:'row',flexWrap:'wrap',gap:8,marginBottom:15},catChoice:{flexDirection:'row',alignItems:'center',gap:7,borderWidth:1,borderColor:'#E3EBE5',borderRadius:11,padding:9},catChoiceActive:{borderColor:C.green,backgroundColor:C.pale},catChoiceTxt:{fontSize:11.5,color:C.text,fontWeight:'700'},chipWrap:{flexDirection:'row',flexWrap:'wrap',gap:7,marginBottom:17},
  privacyNotice:{backgroundColor:C.cream,padding:12,borderRadius:11},privacyText:{fontSize:11,color:'#967449',lineHeight:17},
  roleSwitch:{flexDirection:'row',backgroundColor:'#EDF4EF',borderRadius:12,padding:4,marginBottom:19},roleOpt:{flex:1,paddingVertical:12,alignItems:'center',justifyContent:'center',borderRadius:9},roleOptActive:{backgroundColor:C.white,shadowColor:'#000',shadowOpacity:0.05,shadowRadius:6,elevation:1},roleTxt:{fontSize:11,fontWeight:'700',color:C.muted},roleTxtActive:{color:C.deep},
  profileCard:{backgroundColor:C.white,borderRadius:17,padding:16,marginBottom:15,flexDirection:'row',alignItems:'center',gap:12,borderWidth:1,borderColor:C.border},avatar:{width:43,height:43,borderRadius:14,alignItems:'center',justifyContent:'center'},avatarTxt:{color:C.deep,fontSize:18,fontWeight:'900'},profileName:{fontSize:16,fontWeight:'800',color:C.text},profileSub:{fontSize:11,color:C.muted,marginTop:4},memberBadge:{backgroundColor:C.pale,padding:8,borderRadius:9},
  toggleRow:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',paddingTop:12,paddingBottom:6,borderTopWidth:1,borderColor:C.border},toggleTitle:{fontSize:12,fontWeight:'800',color:C.text},toggleDesc:{fontSize:10,color:C.muted,marginTop:4},fakeToggle:{height:28,width:48,borderRadius:16,backgroundColor:'#CDD7D1',justifyContent:'center',padding:3},fakeToggleOn:{backgroundColor:C.green},toggleKnob:{width:21,height:21,borderRadius:12,backgroundColor:'white'},
  aiModuleRow:{paddingVertical:12,flexDirection:'row',justifyContent:'space-between',gap:8},resetBtn:{backgroundColor:C.softRed,padding:14,borderRadius:12,alignItems:'center',marginBottom:10},disclaimer:{fontSize:10,color:'#91A199',lineHeight:16,marginVertical:12},
  navBar:{height:71,backgroundColor:C.white,borderTopWidth:1,borderTopColor:C.border,flexDirection:'row',justifyContent:'space-around',alignItems:'center',paddingBottom:2},navItem:{flex:1,alignItems:'center',justifyContent:'center',gap:4},navItemActive:{},navIconWrap:{height:32,minWidth:42,borderRadius:10,alignItems:'center',justifyContent:'center'},navIconPlus:{width:39,height:39,borderRadius:14,backgroundColor:C.green,marginTop:-5},navIcon:{fontSize:25,color:'#82948B',fontWeight:'700'},navText:{fontSize:9.1,color:'#84988C',fontWeight:'600'},
  modalBackdrop:{flex:1,backgroundColor:'#071F1A88',justifyContent:'flex-end'},modalSheet:{backgroundColor:C.white,borderTopLeftRadius:26,borderTopRightRadius:26,padding:20,paddingBottom:Platform.OS==='ios'?35:26,maxHeight:'89%'},modalHandle:{alignSelf:'center',width:38,height:4,borderRadius:3,backgroundColor:'#D9E3DD',marginBottom:12},modalHeader:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',marginBottom:12},modalTitle:{fontSize:18,fontWeight:'900',color:C.text},closeBtn:{width:31,height:31,borderRadius:12,backgroundColor:C.bg,alignItems:'center',justifyContent:'center'},modalInfo:{backgroundColor:C.bg,borderRadius:12,padding:13,gap:10},modalLine:{fontSize:12,color:C.text},
  aiExplain:{backgroundColor:'#E9F6EE',borderRadius:13,padding:14},volunteerRow:{backgroundColor:'#FBFDFC',borderWidth:1,borderColor:C.border,borderRadius:13,padding:13,marginBottom:10},volName:{fontSize:13,fontWeight:'800',color:C.text},volMeta:{fontSize:11,color:C.muted,marginTop:4},score:{alignItems:'center',backgroundColor:C.pale,borderRadius:10,paddingHorizontal:10,paddingVertical:6},scoreText:{fontSize:17,fontWeight:'900',color:C.green},scoreSub:{fontSize:9.5,color:C.green},routeText:{fontSize:11,color:C.muted,marginTop:10,lineHeight:17},
});
