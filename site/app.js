/* Banana Deco Party · Revelaciones
   Efectos de revelación (humo, confeti, chispas frías y disparos), enlaces de WhatsApp por paquete y Pixel de Meta. */
(function () {
  'use strict';

  // ===== Configuración =====
  var CONFIG = {
    whatsapp: '51961323186',
    // Pega aquí el ID de tu Pixel de Meta (solo números). Vacío = Pixel desactivado.
    metaPixelId: ''
  };

  // ===== Pixel de Meta =====
  function initPixel() {
    if (!CONFIG.metaPixelId) return;
    /* eslint-disable */
    !function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?
    n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;
    n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;
    t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,
    document,'script','https://connect.facebook.net/en_US/fbevents.js');
    /* eslint-enable */
    window.fbq('init', CONFIG.metaPixelId);
    window.fbq('track', 'PageView');
  }
  function track(evento, datos) {
    try { if (window.fbq) window.fbq('track', evento, datos || {}); } catch (e) { /* sin pixel */ }
  }
  initPixel();

  // ===== WhatsApp con mensaje por paquete =====
  var base = 'https://wa.me/' + CONFIG.whatsapp + '?text=';
  document.querySelectorAll('a.wa').forEach(function (a) {
    var pkg = a.getAttribute('data-pkg');
    var precio = a.getAttribute('data-price');
    var msg = pkg
      ? 'Hola Banana Deco Party, me interesa el paquete ' + pkg + ' (S/ ' + precio + ') para mi revelación de género. ¿Tienen disponible mi fecha?'
      : 'Hola Banana Deco Party, quiero información sobre las revelaciones de género.';
    a.href = base + encodeURIComponent(msg);
    a.addEventListener('click', function () {
      track('Contact', pkg ? { content_name: pkg, value: Number(precio), currency: 'PEN' } : { content_name: 'General' });
    });
  });
  document.querySelectorAll('[data-red]').forEach(function (a) {
    a.addEventListener('click', function () { track('ViewContent', { content_name: 'Red ' + a.getAttribute('data-red') }); });
  });

  // ===== Tortas: 4 puntos de disparo dibujados como cuadrículas =====
  var tortasPorNivel = {};
  document.querySelectorAll('.tortas').forEach(function (cont) {
    var lado = Number(cont.getAttribute('data-lado'));
    var puntos = [];
    for (var p = 0; p < 4; p++) {
      var t = document.createElement('div');
      t.className = 'torta';
      t.style.gridTemplateColumns = 'repeat(' + lado + ', minmax(0, 1fr))';
      var dots = [];
      for (var i = 0; i < lado * lado; i++) {
        var d = document.createElement('i');
        if (p % 2 === 1) d.className = 'c';
        t.appendChild(d);
        dots.push(d);
      }
      cont.appendChild(t);
      puntos.push(dots);
    }
    var pie = document.createElement('p');
    pie.className = 'tortas-pie';
    pie.textContent = '4 puntos × ' + (lado * lado) + ' disparos = ' + (4 * lado * lado) + ' disparos';
    cont.appendChild(pie);
    var art = cont.closest('[data-nivel]');
    if (art) tortasPorNivel[art.getAttribute('data-nivel')] = puntos;
  });

  // ===== Motor de partículas =====
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var cv = document.getElementById('fx');
  var ctx = cv.getContext('2d');
  var W = 0, H = 0, dpr = 1, MAX = 900;

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = window.innerWidth; H = window.innerHeight;
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    MAX = W < 600 ? 650 : 1100;
  }
  resize();
  window.addEventListener('resize', resize);

  var ORO = ['#F2C46D', '#FFE2A3', '#FFF3D1'];
  var CONFETI = ['#2F7FE0', '#1FC8C4', '#FF8FB8', '#E6007E']; // azul, turquesa, rosa, fucsia

  function sprite(r, g, b) {
    var s = document.createElement('canvas');
    s.width = s.height = 128;
    var c = s.getContext('2d');
    // Bocanada irregular: varias manchas suaves en vez de un círculo perfecto
    for (var i = 0; i < 16; i++) {
      var rad = rnd(14, 30), ang = rnd(0, 6.28), dist = rnd(0, 62 - rad);
      var cx = 64 + Math.cos(ang) * dist, cy = 64 + Math.sin(ang) * dist;
      var gr = c.createRadialGradient(cx, cy, 0, cx, cy, rad);
      gr.addColorStop(0, 'rgba(' + r + ',' + g + ',' + b + ',0.34)');
      gr.addColorStop(1, 'rgba(' + r + ',' + g + ',' + b + ',0)');
      c.fillStyle = gr; c.fillRect(0, 0, 128, 128);
    }
    return s;
  }
  function sprites(r, g, b) { return [sprite(r, g, b), sprite(r, g, b), sprite(r, g, b), sprite(r, g, b)]; }
  var HUMO = { rosa: sprites(244, 110, 156), celeste: sprites(95, 170, 235), oro: sprites(242, 196, 109) };

  function rnd(a, b) { return a + Math.random() * (b - a); }
  function pick(arr) { return arr[(Math.random() * arr.length) | 0]; }

  var P = [];       // partículas
  var EM = [];      // emisores activos
  var TO = [];      // temporizadores pendientes
  var running = false, last = 0, now = 0;

  function lleno() { return P.length >= MAX; }

  function confeti(x, y, vx, vy) {
    if (lleno()) return;
    P.push({ k: 0, x: x, y: y, vx: vx, vy: vy, r: rnd(0, 6.28), vr: rnd(-0.2, 0.2),
      w: rnd(6, 11), h: rnd(9, 15), c: pick(CONFETI), ph: rnd(0, 6.28), sw: rnd(0.04, 0.09) });
  }
  function humo(x, y, color, vx, vy, r, crece, vida) {
    if (lleno()) return;
    P.push({ k: 1, x: x, y: y, vx: vx, vy: vy, r: r, g: crece, life: vida, max: vida, a: rnd(0.4, 0.65), s: pick(HUMO[color]),
      rot: rnd(0, 6.28), vrot: rnd(-0.012, 0.012), ph: rnd(0, 6.28), sw: rnd(0.02, 0.05), dr: rnd(0.1, 0.4) });
  }
  function chispa(x, y, vx, vy, c, vida) {
    if (lleno()) return;
    P.push({ k: 2, x: x, y: y, vx: vx, vy: vy, c: c, life: vida, max: vida });
  }
  function disparo(x, yObjetivo, color, dorado) {
    P.push({ k: 3, x: x, y: H + 10, vx: rnd(-0.6, 0.6), vy: rnd(-13, -10.5), ty: yObjetivo, col: color, oro: dorado });
  }

  function emisor(dur, fn) { EM.push({ t0: now, dur: dur, fn: fn }); arrancar(); }
  function luego(ms, fn) { TO.push({ at: now + ms, fn: fn }); arrancar(); }

  function fuente(x, dur, alto) {
    // chisperos de llama fría
    emisor(dur, function () {
      for (var i = 0; i < 3; i++) {
        chispa(x + rnd(-4, 4), H + 2, rnd(-1.1, 1.1), -rnd(alto * 0.75, alto), Math.random() < 0.6 ? '#FFF6E0' : pick(ORO), rnd(40, 70));
      }
    });
  }

  function update(k) {
    for (var i = P.length - 1; i >= 0; i--) {
      var p = P[i];
      if (p.k === 0) {
        if (p.fade) {
          p.fade -= 0.035 * k;
          if (p.fade <= 0) { P.splice(i, 1); continue; }
        }
        p.vy = Math.min(p.vy + 0.08 * k, 3.6);
        p.vx *= Math.pow(0.985, k);
        p.ph += p.sw * k;
        p.x += (p.vx + Math.sin(p.ph) * 0.9) * k;
        p.y += p.vy * k;
        p.r += p.vr * k;
        if (p.y > H + 30) P.splice(i, 1);
      } else if (p.k === 1) {
        // sigue subiendo y la turbulencia crece: el humo se abre y se dispersa
        p.vy -= 0.015 * k;
        p.ph += p.sw * k; p.dr += 0.014 * k; p.rot += p.vrot * k;
        p.x += (p.vx + Math.sin(p.ph) * p.dr) * k; p.y += p.vy * k;
        p.vx *= Math.pow(0.985, k); p.vy *= Math.pow(0.985, k);
        p.r += p.g * k; p.life -= k;
        if (p.life <= 0) P.splice(i, 1);
      } else if (p.k === 2) {
        p.vy += 0.09 * k;
        p.x += p.vx * k; p.y += p.vy * k; p.life -= k;
        if (p.life <= 0) P.splice(i, 1);
      } else {
        p.x += p.vx * k; p.y += p.vy * k;
        if (Math.random() < 0.7) chispa(p.x, p.y + 6, rnd(-0.5, 0.5), rnd(0.5, 1.5), p.oro ? pick(ORO) : '#FFE9F0', rnd(12, 22));
        if (Math.random() < 0.35) humo(p.x, p.y + 10, p.col, rnd(-0.3, 0.3), rnd(-0.2, 0.4), rnd(8, 14), 0.5, rnd(40, 60));
        if (p.y <= p.ty) {
          var n = W < 600 ? 7 : 10;
          for (var j = 0; j < n; j++) {
            var ang = rnd(0, 6.28), sp = rnd(0.6, 2.4);
            humo(p.x, p.y, p.col, Math.cos(ang) * sp, Math.sin(ang) * sp - 0.6, rnd(18, 32), rnd(0.9, 1.6), rnd(90, 140));
          }
          for (var m = 0; m < (p.oro ? 14 : 7); m++) {
            var a2 = rnd(0, 6.28), s2 = rnd(1.5, 4.5);
            chispa(p.x, p.y, Math.cos(a2) * s2, Math.sin(a2) * s2, p.oro ? pick(ORO) : '#FFFFFF', rnd(25, 45));
          }
          P.splice(i, 1);
        }
      }
    }
  }

  function draw() {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, cv.width, cv.height);
    // humo primero (detrás)
    ctx.globalCompositeOperation = 'source-over';
    for (var i = 0; i < P.length; i++) {
      var p = P[i];
      if (p.k !== 1) continue;
      // aparece rápido y se disuelve de forma gradual mientras se expande
      var resto = p.life / p.max;
      ctx.globalAlpha = Math.max(0, p.a * Math.min(1, (1 - resto) / 0.12) * Math.pow(resto, 2.2));
      var cr = Math.cos(p.rot) * dpr, sr = Math.sin(p.rot) * dpr;
      ctx.setTransform(cr, sr, -sr, cr, p.x * dpr, p.y * dpr);
      ctx.drawImage(p.s, -p.r, -p.r, p.r * 2, p.r * 2);
    }
    ctx.globalAlpha = 1;
    // confeti
    for (var c = 0; c < P.length; c++) {
      var q = P[c];
      if (q.k !== 0) continue;
      var co = Math.cos(q.r), si = Math.sin(q.r);
      ctx.setTransform(co * dpr, si * dpr, -si * dpr, co * dpr, q.x * dpr, q.y * dpr);
      ctx.globalAlpha = q.fade || 1;
      ctx.fillStyle = q.c;
      var hh = q.h * Math.abs(Math.sin(q.ph));
      ctx.fillRect(-q.w / 2, -hh / 2, q.w, Math.max(hh, 1.5));
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    // chispas
    ctx.globalCompositeOperation = 'lighter';
    ctx.lineWidth = 1.8; ctx.lineCap = 'round';
    for (var s = 0; s < P.length; s++) {
      var z = P[s];
      if (z.k === 2) {
        ctx.globalAlpha = Math.max(0, z.life / z.max);
        ctx.strokeStyle = z.c;
        ctx.beginPath(); ctx.moveTo(z.x, z.y); ctx.lineTo(z.x - z.vx * 2.2, z.y - z.vy * 2.2); ctx.stroke();
      } else if (z.k === 3) {
        ctx.globalAlpha = 1;
        ctx.fillStyle = '#FFFFFF';
        ctx.beginPath(); ctx.arc(z.x, z.y, 2.6, 0, 6.28); ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }

  function frame(t) {
    if (!running) return;
    var dt = last ? Math.min(t - last, 50) : 16.7;
    last = t; now += dt;
    var k = dt / 16.7;
    for (var i = TO.length - 1; i >= 0; i--) {
      if (now >= TO[i].at) { var f = TO[i].fn; TO.splice(i, 1); f(); }
    }
    for (var e = EM.length - 1; e >= 0; e--) {
      if (now - EM[e].t0 > EM[e].dur) EM.splice(e, 1); else EM[e].fn(k);
    }
    update(k);
    draw();
    if (P.length || EM.length || TO.length) requestAnimationFrame(frame);
    else { running = false; last = 0; ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, cv.width, cv.height); }
  }
  function arrancar() {
    if (running || document.hidden) return;
    running = true; last = 0;
    requestAnimationFrame(frame);
  }
  document.addEventListener('visibilitychange', function () {
    if (!document.hidden && (P.length || EM.length || TO.length)) arrancar();
  });

  // ===== Efectos de cada paquete =====
  var FX = {
    humo: function () {
      fuente(W * 0.1, 1800, 10); fuente(W * 0.9, 1800, 10);
      luego(700, function () {
        emisor(3200, function () {
          for (var i = 0; i < (W < 600 ? 1 : 2); i++) {
            humo(W * 0.3 + rnd(-24, 24), H + 30, 'rosa', rnd(-2.2, 1.8), -rnd(2.6, 7.4), rnd(20, 34), rnd(0.6, 1.5), rnd(120, 210));
            humo(W * 0.7 + rnd(-24, 24), H + 30, 'celeste', rnd(-1.8, 2.2), -rnd(2.6, 7.4), rnd(20, 34), rnd(0.6, 1.5), rnd(120, 210));
          }
        });
      });
    },
    confeti: function () {
      fuente(W * 0.08, 1300, 9); fuente(W * 0.92, 1300, 9);
      luego(650, function () {
        var n = W < 600 ? 170 : 300;
        for (var i = 0; i < n; i++) confeti(rnd(0, W), rnd(-H * 0.5, -10), rnd(-1.5, 1.5), rnd(0.5, 3));
        for (var j = 0; j < 70; j++) confeti(W / 2 + rnd(-20, 20), -10, rnd(-7, 7), rnd(1, 5));
      });
    },
    muro: function (nivel) {
      var porPunto = [0, 5, 8, 12][nivel];
      var dur = [0, 2400, 2800, 3400][nivel];
      var xs = [0.2, 0.4, 0.6, 0.8];
      var colores = ['rosa', 'celeste', 'rosa', 'celeste'];
      var dots = tortasPorNivel[nivel];
      if (dots) dots.forEach(function (arr) { arr.forEach(function (d) { d.classList.remove('on'); }); });
      fuente(W * 0.06, dur + 1600, 11); fuente(W * 0.94, dur + 1600, 11);
      var inicio = 900;
      xs.forEach(function (fx, idx) {
        for (var s = 0; s < porPunto; s++) {
          (function (s) {
            luego(inicio + (dur / porPunto) * s + rnd(0, 120), function () {
              disparo(W * fx + rnd(-12, 12), H * rnd(0.12, 0.32) - (nivel - 1) * 18, colores[idx], nivel === 3 && Math.random() < 0.5);
              if (dots) {
                var arr = dots[idx], por = Math.ceil(arr.length / porPunto);
                for (var q = s * por; q < Math.min(arr.length, (s + 1) * por); q++) arr[q].classList.add('on');
              }
            });
          })(s);
        }
      });
    },
    cierre: function () {
      for (var i = 0; i < 80; i++) confeti(W * 0.15, H + 10, rnd(1, 6), rnd(-15, -9));
      for (var j = 0; j < 80; j++) confeti(W * 0.85, H + 10, rnd(-6, -1), rnd(-15, -9));
    },
    hero: function () {
      for (var i = 0; i < 90; i++) confeti(W * 0.05, H + 10, rnd(1.5, 7), rnd(-17, -10));
      for (var j = 0; j < 90; j++) confeti(W * 0.95, H + 10, rnd(-7, -1.5), rnd(-17, -10));
      for (var h = 0; h < 14; h++) {
        humo(rnd(0, W * 0.45), H + 40, 'rosa', rnd(-0.3, 0.6), -rnd(2, 4), rnd(30, 50), 1.2, rnd(110, 150));
        humo(rnd(W * 0.55, W), H + 40, 'celeste', rnd(-0.6, 0.3), -rnd(2, 4), rnd(30, 50), 1.2, rnd(110, 150));
      }
    }
  };

  function lanzar(el) {
    // El confeti que siga en el aire (p. ej. el de la portada) no se mezcla con este efecto
    P.forEach(function (p) { if (p.k === 0 && !p.fade) p.fade = 1; });
    var tipo = el.getAttribute('data-fx');
    if (tipo === 'muro') FX.muro(Number(el.getAttribute('data-nivel')));
    else if (FX[tipo]) FX[tipo]();
  }

  // ===== Cuenta regresiva de la portada =====
  var conteo = document.getElementById('conteo');
  var caja = conteo ? conteo.parentNode : null;
  function cuentaRegresiva() {
    var n = 3;
    function paso() {
      conteo.textContent = String(n);
      caja.classList.remove('pop'); void caja.offsetWidth; caja.classList.add('pop');
      if (n === 0) { FX.hero(); return; }
      n--; setTimeout(paso, 750);
    }
    paso();
  }
  if (!reduce && conteo) setTimeout(cuentaRegresiva, 500);

  // ===== Disparo de efectos al hacer scroll =====
  var ultimo = new WeakMap();
  var vistos = {};
  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (entradas) {
      entradas.forEach(function (en) {
        if (!en.isIntersecting) return;
        var el = en.target;
        var pkg = el.getAttribute('data-pkg');
        if (pkg && !vistos[pkg]) {
          vistos[pkg] = true;
          track('ViewContent', { content_name: pkg, value: Number(el.getAttribute('data-price')), currency: 'PEN' });
        }
        if (reduce || el.getAttribute('data-fx') === 'hero') return;
        var t = Date.now();
        if (ultimo.has(el) && t - ultimo.get(el) < 9000) return;
        ultimo.set(el, t);
        lanzar(el);
      });
    }, { threshold: 0.45 });
    document.querySelectorAll('[data-fx]').forEach(function (el) { io.observe(el); });

    // videos: solo se reproducen cuando están a la vista
    var vio = new IntersectionObserver(function (entradas) {
      entradas.forEach(function (en) {
        var v = en.target;
        if (en.isIntersecting) {
          if (v.preload !== 'auto') v.preload = 'auto';
          if (!reduce) { var pr = v.play(); if (pr && pr.catch) pr.catch(function () {}); }
        } else { v.pause(); }
      });
    }, { threshold: 0.3, rootMargin: '200px 0px' });
    document.querySelectorAll('video').forEach(function (v) {
      if (reduce) v.controls = true;
      vio.observe(v);
    });
  }

  // ===== Botones "Ver efecto" =====
  document.querySelectorAll('[data-replay]').forEach(function (b) {
    b.addEventListener('click', function () {
      var el = document.getElementById(b.getAttribute('data-replay'));
      if (el) { ultimo.set(el, Date.now()); lanzar(el); }
    });
  });
})();
