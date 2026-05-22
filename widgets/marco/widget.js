// ==== Variables globales ====
    let fieldData = {}, loaded = {}, baseScale = 1, lastPos = { x: 0, y: 0 };

    const debugEl = document.getElementById('debug');
    function debugLog(msg) {
      console.log(msg);
      if (fieldData.debugVisible) {
        const d = document.createElement('div');
        d.textContent = msg;
        debugEl.appendChild(d);
        debugEl.scrollTop = debugEl.scrollHeight;
      }
    }

    // ==== Aplica settings al mando y debug ====
    function applySettings() {
      debugEl.style.display = fieldData.debugVisible ? 'block' : 'none';
      baseScale = parseFloat(fieldData.iconScale) || 1;
      const icon = document.getElementById('controllerIcon');
      icon.style.transform = `translate(${lastPos.x}px,${lastPos.y}px) scale(${baseScale}) rotate(0deg)`;
    }

    // ==== onWidgetLoad ====
    window.addEventListener('onWidgetLoad', ({ detail }) => {
      debugLog('🟢 onWidgetLoad');
      fieldData = detail.fieldData;
      const icon = document.getElementById('controllerIcon');
      icon.style.visibility = 'hidden';
      if (fieldData.controllerIcon) {
        icon.onload = () => {
          const w = icon.naturalWidth || 50;
          lastPos = { x: -w, y: 0 };
          icon.style.visibility = 'visible';
          debugLog(' Icono cargado y posicionado fuera');
          applySettings();
          trigger('todos');
        };
        icon.src = fieldData.controllerIcon;
        debugLog(' Icono asignado (cargando…)');
      } else {
        applySettings();
        trigger('todos');
      }
    });

    // ==== onWidgetUpdate ====
    window.addEventListener('onWidgetUpdate', ({ detail }) => {
      debugLog('🔄 onWidgetUpdate');
      fieldData = detail.fieldData;
      applySettings();
    });

    // ==== onEventReceived ====
    window.addEventListener('onEventReceived', ({ detail }) => {
      debugLog('📥 onEventReceived');
      if (detail.listener !== 'message') return;
      const ev  = detail.event;
      const uid = (ev.data.tags && ev.data.tags['user-id']) || ev.data.userId;
      const txt = ev.data.text || '';
      debugLog(` — user-id=${uid} texto="${txt}"`);

      if (uid !== '133649243') return;

      // diagnóstico:
      debugLog(`   fieldData.todosActive = ${fieldData.todosActive}`);
      debugLog(`   fieldData.todosFrame  = ${fieldData.todosFrame}`);

      if (txt.includes('losbro9Sees')     && fieldData.seeSActive)    { debugLog(' → SeeS');   trigger('seeS'); }
      else if (txt.includes('losbro9Rooles') && fieldData.roolesActive) { debugLog(' → Rooles'); trigger('rooles'); }
      else if (txt.includes('losbro9Ninjat') && fieldData.ninjaTActive) { debugLog(' → NinjaT'); trigger('ninjaT'); }
      else if (txt.includes('todosjuegan')  && fieldData.todosFrame)    { debugLog(' → Todos');  trigger('todos'); }
      else debugLog(' — No match');
    });

    // ==== trigger: cambia vídeo + anima icono ====
    async function trigger(key) {
      debugLog(`▶ trigger(${key})`);
      const vid = document.getElementById(key + 'Frame'),
            url = fieldData[key + 'Frame'];
      if (!loaded[key]) {
        debugLog(`   cargando ${key} desde ${url}`);
        vid.src = url;
        await new Promise(r => vid.addEventListener('canplaythrough', r, { once: true }));
        loaded[key] = true;
        debugLog(`   ${key} cargado`);
      }
      vid.currentTime = 0; vid.play();
      debugLog(`   play ${key}`);
      document.querySelectorAll('.frame').forEach(f => f.classList.remove('active'));
      vid.classList.add('active');
      debugLog(`   fade ${key}`);

      const icon = document.getElementById('controllerIcon');
      if (key === 'todos') {
        icon.style.opacity    = 0;
        icon.style.visibility = 'hidden';
        debugLog('   ocultar icono');
      } else {
        icon.style.visibility = 'visible';
        icon.style.opacity    = 1;
        debugLog(`   animar icono ${key}`);
        animateIcon(key, icon);
      }
    }

    // ==== animateIcon: Web Animations API ====
    function animateIcon(key, icon) {
      const x    = parseFloat(fieldData[key + 'PosX']) || 0;
      const y    = parseFloat(fieldData[key + 'PosY']) || 0;
      const base = baseScale;

      const finalTransform = `translate(${x}px,${y}px) scale(${base}) rotate(0deg)`;
      const initTransform = (lastPos.x === x && lastPos.y === y)
        ? finalTransform
        : `translate(${lastPos.x}px,${lastPos.y}px) scale(${base}) rotate(0deg)`;
      const initOpacity = parseFloat(window.getComputedStyle(icon).opacity);

      // 1) Definición de animaciones
      const animDefs = [
        // Jello–horizontal
        {
          name: 'jello-horizontal',
          keyframes: [
            { offset: 0.00, transform: initTransform },
            { offset: 0.30, transform: `translate(${x}px,${y}px) scale3d(${base*1.25},${base*0.75},1) rotate(0deg)` },
            { offset: 0.40, transform: `translate(${x}px,${y}px) scale3d(${base*0.75},${base*1.25},1) rotate(0deg)` },
            { offset: 0.50, transform: `translate(${x}px,${y}px) scale3d(${base*1.15},${base*0.85},1) rotate(0deg)` },
            { offset: 0.65, transform: `translate(${x}px,${y}px) scale3d(${base*0.95},${base*1.05},1) rotate(0deg)` },
            { offset: 0.75, transform: `translate(${x}px,${y}px) scale3d(${base*1.05},${base*0.95},1) rotate(0deg)` },
            { offset: 1.00, transform: finalTransform }
          ],
          options: { duration: 1500, easing: 'ease-in-out', fill: 'forwards' }
        },
        {
  name: 'swirl-in-bck',
  keyframes: [
    // inicio en initTransform, sin rotar
    { offset: 0.00, transform: `${initTransform} rotate(0deg)` },
    // 20% de desplazamiento, gran escala, rotación 320°
    { offset: 0.20, transform: `
        translate(${lastPos.x + (x - lastPos.x) * 0.2}px,${lastPos.y + (y - lastPos.y) * 0.2}px)
        scale(${base * 1.5})
        rotate(320deg)
      `.replace(/\s+/g,' ') },
    // 30%, mantiene escala, rotación 360°, con blur
    { offset: 0.30, transform: `
        translate(${lastPos.x + (x - lastPos.x) * 0.3}px,${lastPos.y + (y - lastPos.y) * 0.3}px)
        scale(${base * 3})
        rotate(360deg)
      `.replace(/\s+/g,' '),
      filter: 'blur(2px)' },
    // 40%, misma escala, rotación 400°, con más blur
    { offset: 0.40, transform: `
        translate(${lastPos.x + (x - lastPos.x) * 0.4}px,${lastPos.y + (y - lastPos.y) * 0.4}px)
        scale(${base * 3})
        rotate(400deg)
      `.replace(/\s+/g,' '),
      filter: 'blur(4px)' },
    // 100% al final, reutilizamos finalTransform y rotamos 720°
    { offset: 1.00, transform: `${finalTransform} rotate(720deg)` }
  ],
  options: {
    duration: 1000,
    easing: 'ease-in-out',
    fill: 'forwards'
  }
},
{
      name: 'text-blur-out',
      keyframes: [
        { offset: 0, filter: 'blur(0px)',  opacity: 1, transform: initTransform },
        { offset: 1, filter: 'blur(12px)', opacity: 0, transform: initTransform }
      ],
      options: { duration: 1000, easing: 'ease-in-out', fill: 'forwards' },
      chain: {
        keyframes: [
          { offset: 0, filter: 'blur(12px)', opacity: 0, transform: finalTransform },
          { offset: 1, filter: 'blur(0px)',  opacity: 1, transform: finalTransform }
        ],
        options: { duration: 1000, easing: 'ease-in-out', fill: 'forwards' }
      }
    }
      ];

      // 2) Selección + log
      const idx = Math.floor(Math.random() * animDefs.length);
      const def = animDefs[idx];
      debugLog(`→ Animación «${def.name}» seleccionada`);

      // 3) Ejecución genérica
      if (def.chain) {
        const p1 = icon.animate(def.keyframes, def.options);
        p1.onfinish = () => {
          const p2 = icon.animate(def.chain.keyframes, def.chain.options);
          p2.onfinish = () => {
            icon.style.transform = finalTransform;
            lastPos = { x, y };
          };
        };
      } else {
        const player = icon.animate(def.keyframes, def.options);
        player.onfinish = () => {
          icon.style.transform = finalTransform;
          lastPos = { x, y };
        };
      }
    }
