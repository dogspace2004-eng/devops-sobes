(function(){
  "use strict";
  var DATA = window.DEVOPS_DATA || {sections:[], total:0};

  /* ---------- build flat model ---------- */
  var QUESTIONS = [];   // {id,q,a,catId,h1,h2}
  var CATS = [];        // {id,h1,h2,qids:[]}
  var Q_BY_ID = {};
  (function(){
    var ci = 0;
    DATA.sections.forEach(function(sec){
      sec.categories.forEach(function(cat){
        var cid = "c" + (ci++);
        var entry = {id:cid, h1:sec.h1, h2:cat.h2, qids:[]};
        CATS.push(entry);
        cat.questions.forEach(function(q){
          var item = {id:q.id, q:q.q, a:q.a, catId:cid, h1:sec.h1, h2:cat.h2};
          QUESTIONS.push(item); Q_BY_ID[q.id] = item; entry.qids.push(q.id);
        });
      });
    });
  })();
  var TOTAL = QUESTIONS.length;

  /* ---------- roadmap (curated systematic path over the 18 topics) ---------- */
  var ROADMAP = [
    {t:"Железо и системы", ic:"🖥", cats:["Железячные вопросы","Просмотр информации о железной составляющей сервера"]},
    {t:"Linux", ic:"🐧", cats:["Linux","Диски и файловая система","Debug"]},
    {t:"Сети", ic:"🌐", cats:["Сети сеть"]},
    {t:"Контейнеры (Docker)", ic:"📦", cats:["Docker контейнеры"]},
    {t:"Kubernetes", ic:"☸️", cats:["KUBERNETES"]},
    {t:"Git и CI/CD", ic:"🔧", cats:["GIT","GITLAB CI/CD","Рабочий процесс"]},
    {t:"IaC и конфигурация", ic:"📜", cats:["Terraform","Ansible"]},
    {t:"Базы данных", ic:"🗄", cats:["СУБД Базы Mysql","Что такое роли в pgsql"]},
    {t:"Облако (AWS)", ic:"☁️", cats:["Cloud ( AWS )"]},
    {t:"Скриптинг (Python)", ic:"🐍", cats:["Python"]},
    {t:"Разное", ic:"✳️", cats:["Общее"]}
  ];
  var CAT_BY_H2 = {}; CATS.forEach(function(c){ CAT_BY_H2[c.h2]=c; });
  function shuffle(a){ a=a.slice(); for(var i=a.length-1;i>0;i--){ var j=Math.floor(Math.random()*(i+1)); var t=a[i];a[i]=a[j];a[j]=t; } return a; }
  function fmtDur(s){ var m=Math.floor(s/60), r=s%60; return m+":"+(r<10?"0":"")+r; }
  function scopeLabel(scope){ if(scope==="all") return "Все темы"; if(scope==="review") return "Слабые места"; if(scope&&scope.indexOf("stage:")===0) return scope.slice(6); return scope||"Собес"; }

  /* ---------- persistence ---------- */
  function load(key, def){ try{ var r=localStorage.getItem(key); return r?JSON.parse(r):def; }catch(e){ return def; } }
  function save(key, v){ try{ localStorage.setItem(key, JSON.stringify(v)); }catch(e){} }
  var STATUS = load("di_status_v1", {});   // id -> 'known' | 'review'
  var FAV = load("di_fav_v1", {});          // id -> 1
  var MOCKS = load("di_mock_history_v1", []); // [{date,total,scoreNum,pct,scope,scopeLabel,durationSec}]
  function saveMocks(){ save("di_mock_history_v1", MOCKS); }
  function setStatus(id, s){ if(STATUS[id]===s) delete STATUS[id]; else STATUS[id]=s; save("di_status_v1", STATUS); }
  function toggleFav(id){ if(FAV[id]) delete FAV[id]; else FAV[id]=1; save("di_fav_v1", FAV); }

  var knownCount = function(){ var n=0; for(var k in STATUS) if(STATUS[k]==="known") n++; return n; };
  var reviewCount = function(){ var n=0; for(var k in STATUS) if(STATUS[k]==="review") n++; return n; };
  var favCount = function(){ return Object.keys(FAV).length; };
  function catKnown(cat){ var n=0; cat.qids.forEach(function(id){ if(STATUS[id]==="known") n++; }); return n; }

  /* ---------- theme ---------- */
  (function(){
    var t = load("di_theme", null);
    if(!t){ t = (window.matchMedia && matchMedia("(prefers-color-scheme: dark)").matches) ? "dark":"light"; }
    document.documentElement.setAttribute("data-theme", t);
    updateThemeIcon(t);
  })();
  function updateThemeIcon(t){ var b=document.getElementById("theme"); if(b) b.textContent = t==="dark"?"☀️":"🌙"; }
  document.getElementById("theme").onclick=function(){
    var cur=document.documentElement.getAttribute("data-theme")==="dark"?"light":"dark";
    document.documentElement.setAttribute("data-theme",cur); save("di_theme",cur); updateThemeIcon(cur);
  };

  /* ---------- markdown ---------- */
  var mdCache = {};
  function esc(s){ return String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;"); }
  function renderMd(src){
    if(typeof marked!=="undefined" && marked.parse){
      try{ return marked.parse(src, {gfm:true, breaks:false}); }catch(e){}
    }
    return "<pre>"+esc(src)+"</pre>";
  }
  function answerHtml(id){
    if(mdCache[id]) return mdCache[id];
    var h = renderMd(Q_BY_ID[id].a || "_Ответ в источнике отсутствует._");
    mdCache[id]=h; return h;
  }
  function highlightIn(el){
    if(typeof hljs==="undefined") return;
    el.querySelectorAll("pre code").forEach(function(c){ try{ hljs.highlightElement(c); }catch(e){} });
  }

  /* ---------- state ---------- */
  var VIEW = { filter:"overview", search:"" };

  /* ---------- sidebar ---------- */
  function navItem(icon,label,count,active,onClick){
    var b=document.createElement("button"); b.className="navitem"+(active?" active":"");
    b.innerHTML='<span class="ic">'+icon+'</span><span class="lbl"></span>'+(count!=null?'<span class="ct">'+count+'</span>':'');
    b.querySelector(".lbl").textContent=label;
    b.onclick=onClick; return b;
  }
  function renderSidebar(){
    var side=document.getElementById("sidebar"); side.innerHTML="";
    var g1=document.createElement("div"); g1.className="navgroup";
    g1.appendChild(navItem("📊","Обзор",null,VIEW.filter==="overview",function(){ go("overview"); }));
    g1.appendChild(navItem("🗺","Роадмап",null,VIEW.filter==="roadmap",function(){ go("roadmap"); }));
    g1.appendChild(navItem("🎓","Собеседования",MOCKS.length||null,VIEW.filter==="mock",function(){ go("mock"); }));
    g1.appendChild(navItem("📚","Все вопросы",TOTAL,VIEW.filter==="all",function(){ go("all"); }));
    g1.appendChild(navItem("⭐","Избранное",favCount(),VIEW.filter==="fav",function(){ go("fav"); }));
    g1.appendChild(navItem("🔁","На повторение",reviewCount(),VIEW.filter==="review",function(){ go("review"); }));
    side.appendChild(g1);

    // categories grouped by h1
    var lastH1=null, grp=null;
    CATS.forEach(function(cat){
      if(cat.h1!==lastH1){
        lastH1=cat.h1;
        grp=document.createElement("div"); grp.className="navgroup";
        var h=document.createElement("div"); h.className="gh"; h.textContent=cat.h1; grp.appendChild(h);
        side.appendChild(grp);
      }
      var cnt=catKnown(cat)+"/"+cat.qids.length;
      grp.appendChild(navItem("•",cat.h2,cnt,VIEW.filter===("cat:"+cat.id),function(){ go("cat:"+cat.id); }));
    });
  }

  function currentQids(){
    if(VIEW.filter==="custom") return VIEW.customIds||[];
    if(VIEW.search){
      var s=VIEW.search.toLowerCase();
      return QUESTIONS.filter(function(q){ return q.q.toLowerCase().indexOf(s)>=0 || (q.a||"").toLowerCase().indexOf(s)>=0; }).map(function(q){return q.id;});
    }
    if(VIEW.filter==="all") return QUESTIONS.map(function(q){return q.id;});
    if(VIEW.filter==="fav") return QUESTIONS.filter(function(q){return FAV[q.id];}).map(function(q){return q.id;});
    if(VIEW.filter==="review") return QUESTIONS.filter(function(q){return STATUS[q.id]==="review";}).map(function(q){return q.id;});
    if(VIEW.filter.indexOf("cat:")===0){ var c=CATS.find(function(x){return x.id===VIEW.filter.slice(4);}); return c?c.qids.slice():[]; }
    return [];
  }

  /* ---------- main renders ---------- */
  function go(filter){ mock=null; deck=null; VIEW.filter=filter; VIEW.search=""; var s=document.getElementById("search"); if(s) s.value=""; closeMenu(); render(); }
  function render(){
    renderSidebar(); updatePill();
    if(VIEW.search) renderList();
    else if(VIEW.filter==="overview") renderOverview();
    else if(VIEW.filter==="roadmap") renderRoadmap();
    else if(VIEW.filter==="mock") renderMock();
    else renderList();
    window.scrollTo(0,0); var m=document.getElementById("main"); if(m) m.scrollTop=0;
  }

  function updatePill(){ document.getElementById("prog-pill").innerHTML='Знаю <b>'+knownCount()+'</b> / '+TOTAL; }

  function titleFor(){
    if(VIEW.filter==="custom") return VIEW.customTitle||"Подборка";
    if(VIEW.search) return "Поиск: «"+VIEW.search+"»";
    if(VIEW.filter==="all") return "Все вопросы";
    if(VIEW.filter==="fav") return "Избранное";
    if(VIEW.filter==="review") return "На повторение";
    if(VIEW.filter.indexOf("cat:")===0){ var c=CATS.find(function(x){return x.id===VIEW.filter.slice(4);}); return c?c.h2:""; }
    return "Обзор";
  }

  function renderOverview(){
    var main=document.getElementById("main");
    var known=knownCount(), review=reviewCount(), fav=favCount();
    var pct = TOTAL? Math.round(known/TOTAL*100):0;
    var html='<div class="mhead"><h1>Обзор подготовки</h1><span class="sub">'+TOTAL+' вопросов · '+CATS.length+' тем</span></div>';
    html+='<div class="grid" style="margin-top:18px">'
      +'<div class="stat acc"><div class="n">'+pct+'%</div><div class="l">пройдено</div></div>'
      +'<div class="stat good"><div class="n">'+known+'</div><div class="l">знаю</div></div>'
      +'<div class="stat warn"><div class="n">'+review+'</div><div class="l">на повторение</div></div>'
      +'<div class="stat"><div class="n">'+fav+'</div><div class="l">в избранном</div></div>'
      +'</div>';
    html+='<div class="mtools" style="margin-top:22px"><button class="btn primary" id="ov-mock">🎓 Собеседование</button><button class="btn" id="ov-study">🎴 Учить карточки</button>'
      + (review? '<button class="btn" id="ov-review">🔁 Повторить слабые ('+review+')</button>':'')
      + '<button class="btn" id="ov-road">🗺 Роадмап</button></div>';
    html+='<h1 style="font-size:16px;margin:24px 0 6px">Прогресс по темам</h1><div class="bars">';
    CATS.forEach(function(cat){
      var k=catKnown(cat), t=cat.qids.length, p=t?Math.round(k/t*100):0;
      html+='<div class="barrow"><span class="bl" data-cat="'+cat.id+'">'+esc(cat.h2)+'</span>'
        +'<span class="bar"><i style="width:'+p+'%"></i></span><span class="bn">'+k+'/'+t+'</span></div>';
    });
    html+='</div>';
    main.innerHTML=html;
    var mkb=document.getElementById("ov-mock"); if(mkb) mkb.onclick=function(){ go("mock"); };
    var rdb=document.getElementById("ov-road"); if(rdb) rdb.onclick=function(){ go("roadmap"); };
    var sb=document.getElementById("ov-study"); if(sb) sb.onclick=function(){ startStudy(QUESTIONS.map(function(q){return q.id;}),"Все карточки"); };
    var rb=document.getElementById("ov-review"); if(rb) rb.onclick=function(){ startStudy(QUESTIONS.filter(function(q){return STATUS[q.id]==="review";}).map(function(q){return q.id;}),"Повторение"); };
    main.querySelectorAll(".bl[data-cat]").forEach(function(el){ el.onclick=function(){ go("cat:"+el.getAttribute("data-cat")); }; });
  }

  function hlText(text, term){
    var safe=esc(text);
    if(!term) return safe;
    var i=text.toLowerCase().indexOf(term.toLowerCase());
    if(i<0) return safe;
    // перестроим с подсветкой по исходному тексту
    var before=esc(text.slice(0,i)), match=esc(text.slice(i,i+term.length)), after=esc(text.slice(i+term.length));
    return before+'<span class="hl">'+match+'</span>'+after;
  }

  function renderList(){
    var main=document.getElementById("main");
    var ids=currentQids();
    var head='<div class="mhead"><h1>'+esc(titleFor())+'</h1><span class="sub">'+ids.length+' '+plural(ids.length)+'</span></div>';
    var tools=ids.length? '<div class="mtools"><button class="btn primary" id="study">🎴 Режим карточек</button></div>':'';
    main.innerHTML=head+tools+'<div class="list" id="list"></div>';
    var list=document.getElementById("list");
    if(!ids.length){ list.innerHTML='<div class="empty">Ничего не найдено.</div>'; return; }
    var sb=document.getElementById("study"); if(sb) sb.onclick=function(){ startStudy(ids, titleFor()); };
    ids.forEach(function(id){ list.appendChild(card(id)); });
  }
  function plural(n){ var a=Math.abs(n)%100, b=a%10; if(a>10&&a<20) return "вопросов"; if(b>1&&b<5) return "вопроса"; if(b===1) return "вопрос"; return "вопросов"; }

  function card(id){
    var q=Q_BY_ID[id];
    var st=STATUS[id];
    var el=document.createElement("article"); el.className="card"+(st?(" "+st):""); el.setAttribute("data-id",id);
    var top=document.createElement("div"); top.className="top";
    var chev=document.createElement("span"); chev.className="chev"; chev.textContent="▸";
    var qb=document.createElement("button"); qb.className="qbtn";
    qb.innerHTML='<span class="cat">'+esc(q.h2)+'</span>'+hlText(q.q, VIEW.search);
    var ctrls=document.createElement("div"); ctrls.className="ctrls";
    var star=document.createElement("button"); star.className="star"+(FAV[id]?" on":""); star.textContent="★"; star.title="В избранное";
    var kb=document.createElement("button"); kb.className="sbtn known"+(st==="known"?" on":""); kb.textContent="Знаю";
    var rb=document.createElement("button"); rb.className="sbtn review"+(st==="review"?" on":""); rb.textContent="Повторить";
    ctrls.appendChild(star); ctrls.appendChild(kb); ctrls.appendChild(rb);
    top.appendChild(chev); top.appendChild(qb); top.appendChild(ctrls);
    var ans=document.createElement("div"); ans.className="answer"; ans.hidden=true;
    el.appendChild(top); el.appendChild(ans);

    var rendered=false;
    function toggle(){
      if(ans.hidden){ if(!rendered){ ans.innerHTML=answerHtml(id); highlightIn(ans); rendered=true; } ans.hidden=false; el.classList.add("open"); }
      else { ans.hidden=true; el.classList.remove("open"); }
    }
    qb.onclick=toggle; chev.onclick=toggle;
    star.onclick=function(e){ e.stopPropagation(); toggleFav(id); star.classList.toggle("on"); updateAfterStatus(); };
    kb.onclick=function(e){ e.stopPropagation(); setStatus(id,"known"); refreshCard(el,id); updateAfterStatus(); };
    rb.onclick=function(e){ e.stopPropagation(); setStatus(id,"review"); refreshCard(el,id); updateAfterStatus(); };
    return el;
  }
  function refreshCard(el,id){
    var st=STATUS[id];
    el.className="card open"+(st?(" "+st):"")+(el.querySelector(".answer").hidden?"":"");
    if(el.querySelector(".answer").hidden) el.classList.remove("open");
    el.querySelector(".sbtn.known").classList.toggle("on",st==="known");
    el.querySelector(".sbtn.review").classList.toggle("on",st==="review");
  }
  function updateAfterStatus(){ updatePill(); renderSidebar(); }

  /* ---------- study / flashcards ---------- */
  var deck=null;
  function startStudy(ids, title){
    if(!ids.length) return;
    deck={ids:ids.slice(), i:0, title:title};
    closeMenu(); renderStudy();
  }
  function renderStudy(){
    var main=document.getElementById("main");
    if(deck.i>=deck.ids.length){
      var k=0; deck.ids.forEach(function(id){ if(STATUS[id]==="known") k++; });
      main.innerHTML='<div class="deck"><div class="mhead"><h1>Колода пройдена</h1></div>'
        +'<div class="flash"><div class="fq">Готово! «'+esc(deck.title)+'»</div>'
        +'<p class="sub" style="margin-top:12px">Отмечено «знаю»: '+k+' из '+deck.ids.length+'.</p>'
        +'<div class="acts"><button class="btn primary" id="again">Пройти заново</button><button class="btn" id="back">К списку</button></div></div></div>';
      document.getElementById("again").onclick=function(){ deck.i=0; renderStudy(); };
      document.getElementById("back").onclick=function(){ deck=null; render(); };
      return;
    }
    var id=deck.ids[deck.i], q=Q_BY_ID[id];
    var pct=Math.round(deck.i/deck.ids.length*100);
    main.innerHTML='<div class="deck">'
      +'<div class="mhead"><h1 style="font-size:18px">🎴 '+esc(deck.title)+'</h1></div>'
      +'<div class="deckbar"><span class="prog"><i style="width:'+pct+'%"></i></span><span class="c">'+(deck.i+1)+' / '+deck.ids.length+'</span>'
      +'<button class="btn sm" id="exit">Выйти</button></div>'
      +'<div class="flash"><div class="fcat">'+esc(q.h2)+'</div><div class="fq">'+esc(q.q)+'</div>'
      +'<div class="fa" id="fa" hidden></div>'
      +'<div class="acts" id="acts"><button class="btn primary" id="reveal" style="flex:1">Показать ответ</button></div>'
      +'</div></div>';
    document.getElementById("exit").onclick=function(){ deck=null; render(); };
    document.getElementById("reveal").onclick=function(){
      var fa=document.getElementById("fa"); fa.innerHTML=answerHtml(id); highlightIn(fa); fa.hidden=false;
      document.getElementById("acts").innerHTML=
        '<button class="btn" id="dreview">🔁 Повторить</button>'
        +'<button class="btn primary" id="dknow">✓ Знаю</button>';
      document.getElementById("dknow").onclick=function(){ STATUS[id]="known"; save("di_status_v1",STATUS); next(); };
      document.getElementById("dreview").onclick=function(){ STATUS[id]="review"; save("di_status_v1",STATUS); next(); };
    };
    function next(){ deck.i++; updatePill(); renderStudy(); }
  }

  /* ---------- search ---------- */
  var searchT=null;
  document.getElementById("search").addEventListener("input", function(e){
    var v=e.target.value.trim();
    clearTimeout(searchT);
    searchT=setTimeout(function(){ VIEW.search=v; render(); }, 160);
  });
  document.addEventListener("keydown", function(e){
    if(e.key==="/" && document.activeElement.tagName!=="INPUT" && document.activeElement.tagName!=="TEXTAREA"){ e.preventDefault(); document.getElementById("search").focus(); }
    if(e.key==="Escape"){ var s=document.getElementById("search"); if(document.activeElement===s){ s.value=""; VIEW.search=""; render(); } }
  });

  /* ---------- mobile menu ---------- */
  function openMenu(){ document.getElementById("sidebar").classList.add("show"); document.getElementById("scrim").classList.add("show"); }
  function closeMenu(){ document.getElementById("sidebar").classList.remove("show"); document.getElementById("scrim").classList.remove("show"); }
  document.getElementById("menu").onclick=openMenu;
  document.getElementById("scrim").onclick=closeMenu;
  var homeBtn=document.getElementById("home"); if(homeBtn) homeBtn.onclick=function(){ go("overview"); };

  /* ---------- roadmap view ---------- */
  function renderRoadmap(){
    var main=document.getElementById("main");
    var html='<div class="mhead"><h1>Роадмап DevOps</h1><span class="sub">путь от основ до облака · '+TOTAL+' вопросов</span></div>';
    html+='<p class="muted" style="max-width:660px;margin:8px 0 0">Иди сверху вниз — каждый этап опирается на предыдущий. Зелёным отмечено то, что уже знаешь. Нажми тему, чтобы разобрать её вопросы.</p>';
    html+='<div class="road">';
    ROADMAP.forEach(function(stg){
      var cats=stg.cats.map(function(n){return CAT_BY_H2[n];}).filter(Boolean);
      var t=0,k=0; cats.forEach(function(c){ t+=c.qids.length; k+=catKnown(c); });
      var pct=t?Math.round(k/t*100):0;
      var state=pct>=100?"done":(pct>0?"act":"todo");
      html+='<div class="rstage '+state+'"><div class="rnode">'+(state==="done"?"✓":stg.ic)+'</div>'
        +'<div class="rbody"><div class="rhead"><b>'+esc(stg.t)+'</b><span class="rpct">'+k+' / '+t+' · '+pct+'%</span></div>'
        +'<div class="rbar"><i style="width:'+pct+'%"></i></div><div class="rcats">';
      cats.forEach(function(c){ html+='<button class="rcat" data-cat="'+c.id+'">'+esc(c.h2)+' <span>'+catKnown(c)+'/'+c.qids.length+'</span></button>'; });
      html+='</div></div></div>';
    });
    html+='</div>';
    main.innerHTML=html;
    main.querySelectorAll(".rcat[data-cat]").forEach(function(b){ b.onclick=function(){ go("cat:"+b.getAttribute("data-cat")); }; });
  }

  /* ---------- mock interviews ---------- */
  var mock=null;
  function optBtns(group,pairs,def){ return pairs.map(function(p){ return '<button class="opt'+(p[0]===def?" active":"")+'" data-g="'+group+'" data-v="'+p[0]+'">'+esc(p[1])+'</button>'; }).join(""); }
  function wireOpts(){ document.querySelectorAll(".opt[data-g]").forEach(function(b){ b.onclick=function(){ document.querySelectorAll('.opt[data-g="'+b.getAttribute("data-g")+'"]').forEach(function(x){x.classList.remove("active");}); b.classList.add("active"); }; }); }
  function getOpt(group){ var b=document.querySelector('.opt[data-g="'+group+'"].active'); return b?b.getAttribute("data-v"):null; }

  function renderMock(){
    if(mock){ renderMockRun(); return; }
    var main=document.getElementById("main");
    var html='<div class="mhead"><h1>Тестовые собеседования</h1><span class="sub">вопрос → эталонный ответ → самооценка → результат</span></div>';
    html+='<p class="muted" style="max-width:660px;margin:8px 0 18px">Отвечай про себя, как на реальном собесе. Затем открывай эталонный ответ и честно оцени: ответил / частично / не смог. В конце — процент, разбор по темам и ошибки уходят в повторение.</p>';
    html+='<div class="setup">';
    html+='<div class="srow"><span class="sl">Длина</span><div class="opts">'+optBtns("len",[["10","Экспресс · 10"],["20","Стандарт · 20"],["30","Полный · 30"]],"10")+'</div></div>';
    var scopeOpts=[["all","Все темы"],["review","Слабые места"]].concat(ROADMAP.map(function(s){return ["stage:"+s.t,s.t];}));
    html+='<div class="srow"><span class="sl">Темы</span><div class="opts">'+optBtns("scope",scopeOpts,"all")+'</div></div>';
    html+='<button class="btn primary" id="mstart" style="margin-top:18px">🎓 Начать собеседование</button>';
    html+='<p class="muted" id="mnote" style="margin-top:10px;font-size:13px" hidden></p></div>';
    if(MOCKS.length){
      html+='<h1 style="font-size:16px;margin:28px 0 8px">История собеседований</h1><div class="list" style="max-width:860px">';
      MOCKS.slice(-10).reverse().forEach(function(m){
        var cls=m.pct>=80?"s-known":(m.pct>=50?"s-review":"s-bad");
        html+='<div class="mitem"><span class="mpct '+cls+'">'+m.pct+'%</span><span class="mt">'+esc(m.scopeLabel)+' · '+m.total+' вопр.</span><span class="md">'+m.date+' · '+fmtDur(m.durationSec)+'</span></div>';
      });
      html+='</div>';
    }
    main.innerHTML=html; wireOpts();
    document.getElementById("mstart").onclick=function(){ startMock(getOpt("len"),getOpt("scope")); };
  }

  function startMock(len,scope){
    len=parseInt(len,10)||10;
    var pool;
    if(scope==="review") pool=QUESTIONS.filter(function(q){return STATUS[q.id]==="review";}).map(function(q){return q.id;});
    else if(scope&&scope.indexOf("stage:")===0){ var st=ROADMAP.find(function(s){return s.t===scope.slice(6);}); var ids=[]; if(st) st.cats.forEach(function(n){ var c=CAT_BY_H2[n]; if(c) ids=ids.concat(c.qids); }); pool=ids; }
    else pool=QUESTIONS.map(function(q){return q.id;});
    if(!pool.length){ var n=document.getElementById("mnote"); if(n){ n.hidden=false; n.textContent="В этой выборке нет вопросов — выбери другую тему."; } return; }
    var ids=shuffle(pool).slice(0, Math.min(len, pool.length));
    mock={ids:ids, i:0, grades:{}, start:Date.now(), scope:scope, scopeLabel:scopeLabel(scope)};
    renderMockRun();
  }

  function renderMockRun(){
    var main=document.getElementById("main");
    if(mock.i>=mock.ids.length){ renderMockResult(); return; }
    var id=mock.ids[mock.i], q=Q_BY_ID[id];
    var pct=Math.round(mock.i/mock.ids.length*100);
    main.innerHTML='<div class="deck">'
      +'<div class="deckbar"><button class="btn sm" id="mexit">✕ Прервать</button><span class="prog"><i style="width:'+pct+'%"></i></span><span class="c">Вопрос '+(mock.i+1)+' / '+mock.ids.length+'</span></div>'
      +'<div class="flash"><div class="fcat">'+esc(q.h2)+'</div><div class="fq">'+esc(q.q)+'</div>'
      +'<div class="fa" id="fa" hidden></div>'
      +'<div class="acts" id="acts"><button class="btn primary" id="reveal" style="flex:1">Показать эталонный ответ</button></div></div></div>';
    document.getElementById("mexit").onclick=function(){ if(confirm("Прервать собеседование? Результат не сохранится.")){ mock=null; render(); } };
    document.getElementById("reveal").onclick=function(){
      var fa=document.getElementById("fa"); fa.innerHTML=answerHtml(id); highlightIn(fa); fa.hidden=false;
      document.getElementById("acts").innerHTML='<button class="btn gno" id="g-no">✗ Не смог</button><button class="btn gpart" id="g-part">~ Частично</button><button class="btn primary gok" id="g-ok">✓ Ответил</button>';
      document.getElementById("g-ok").onclick=function(){ grade("ok"); };
      document.getElementById("g-part").onclick=function(){ grade("part"); };
      document.getElementById("g-no").onclick=function(){ grade("no"); };
    };
    function grade(v){ mock.grades[id]=v; mock.i++; renderMockRun(); }
  }

  function renderMockResult(){
    var main=document.getElementById("main");
    var ok=0,part=0,no=0,score=0;
    mock.ids.forEach(function(id){ var g=mock.grades[id]; if(g==="ok"){ok++;score+=1;} else if(g==="part"){part++;score+=0.5;} else no++; });
    var pct=Math.round(score/mock.ids.length*100);
    var dur=Math.round((Date.now()-mock.start)/1000);
    var missed=mock.ids.filter(function(id){ return mock.grades[id]!=="ok"; });
    mock.ids.forEach(function(id){ if(mock.grades[id]==="ok") STATUS[id]="known"; else STATUS[id]="review"; });
    save("di_status_v1",STATUS);
    MOCKS.push({date:new Date().toISOString().slice(0,10), total:mock.ids.length, scoreNum:score, pct:pct, scope:mock.scope, scopeLabel:mock.scopeLabel, durationSec:dur});
    if(MOCKS.length>50) MOCKS=MOCKS.slice(-50); saveMocks();
    updatePill(); renderSidebar();
    var byCat={}; mock.ids.forEach(function(id){ var q=Q_BY_ID[id], g=mock.grades[id]; byCat[q.h2]=byCat[q.h2]||{ok:0,t:0}; byCat[q.h2].t++; if(g==="ok")byCat[q.h2].ok++; });
    var verdict=pct>=80?["Отличный результат","s-known"]:(pct>=50?["Неплохо, но есть пробелы","s-review"]:["Нужно подтянуть","s-bad"]);
    var html='<div class="deck"><div class="mhead"><h1>Результат собеседования</h1></div>';
    html+='<div class="result"><div class="rscore '+verdict[1]+'">'+pct+'%</div><div class="rmeta"><b>'+esc(verdict[0])+'</b>'
      +'<span>'+ok+' ответил · '+part+' частично · '+no+' не смог</span><span class="muted">'+mock.ids.length+' вопросов · '+fmtDur(dur)+'</span></div></div>';
    html+='<div class="bars" style="margin-top:20px">';
    Object.keys(byCat).forEach(function(h2){ var c=byCat[h2], p=Math.round(c.ok/c.t*100); html+='<div class="barrow"><span class="bl">'+esc(h2)+'</span><span class="bar"><i style="width:'+p+'%"></i></span><span class="bn">'+c.ok+'/'+c.t+'</span></div>'; });
    html+='</div>';
    html+='<p class="muted" style="margin-top:16px">Верные отмечены «знаю», '+missed.length+' на повторение.</p>';
    html+='<div class="acts" style="margin-top:14px">';
    if(missed.length) html+='<button class="btn" id="r-missed">Разобрать ошибки ('+missed.length+')</button>';
    html+='<button class="btn" id="r-new">Новый собес</button><button class="btn primary" id="r-again">Пройти заново</button></div></div>';
    main.innerHTML=html;
    var againIds=mock.ids.slice(), sc=mock.scope, scl=mock.scopeLabel, missedCopy=missed.slice();
    document.getElementById("r-again").onclick=function(){ mock={ids:shuffle(againIds),i:0,grades:{},start:Date.now(),scope:sc,scopeLabel:scl}; renderMockRun(); };
    document.getElementById("r-new").onclick=function(){ mock=null; render(); };
    var mb=document.getElementById("r-missed"); if(mb) mb.onclick=function(){ mock=null; showIds(missedCopy,"Ошибки собеседования"); };
  }

  function showIds(ids,title){ VIEW.filter="custom"; VIEW.search=""; VIEW.customIds=ids; VIEW.customTitle=title; render(); }

  /* ---------- boot ---------- */
  if(!TOTAL){ document.getElementById("main").innerHTML='<div class="empty">Данные не загрузились. Проверь, что рядом лежит data.js.</div>'; }
  else { render(); }
})();
