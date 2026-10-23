/* Portfolio interactions:
   1. Three.js particle network hero (nodes + connecting lines) that reacts to the mouse.
   2. Subtle 3D tilt on project cards.
   3. Gentle scroll reveal for sections and cards (IntersectionObserver).
   Everything degrades gracefully: no WebGL or no Three.js means the CSS fallback shows,
   and the reveal hidden state is applied by this script only, so content stays fully
   visible with JavaScript disabled or when reduced motion is preferred. */

(function () {
  "use strict";

  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---------- 3D tilt on project cards ---------- */

  function initTilt() {
    var cards = document.querySelectorAll(".tilt");
    var fine = window.matchMedia("(pointer: fine)").matches;
    if (!fine || reduceMotion) return;

    cards.forEach(function (card) {
      var raf = null;

      card.addEventListener("pointermove", function (e) {
        var rect = card.getBoundingClientRect();
        var x = (e.clientX - rect.left) / rect.width - 0.5;
        var y = (e.clientY - rect.top) / rect.height - 0.5;
        if (raf) cancelAnimationFrame(raf);
        raf = requestAnimationFrame(function () {
          card.style.transform =
            "perspective(800px) rotateX(" + (-y * 9).toFixed(2) + "deg) rotateY(" + (x * 9).toFixed(2) + "deg) translateY(-3px)";
        });
      });

      card.addEventListener("pointerleave", function () {
        if (raf) cancelAnimationFrame(raf);
        card.style.transform = "";
      });
    });
  }

  /* ---------- Three.js constellation hero ---------- */

  function initHero() {
    var canvas = document.getElementById("bg3d");
    if (!canvas) return;

    if (typeof THREE === "undefined") {
      document.body.classList.add("no-webgl");
      return;
    }

    var renderer;
    try {
      renderer = new THREE.WebGLRenderer({
        canvas: canvas,
        antialias: true,
        alpha: true,
        powerPreference: "low-power"
      });
    } catch (err) {
      document.body.classList.add("no-webgl");
      return;
    }

    var hero = canvas.parentElement;
    var scene = new THREE.Scene();
    var camera = new THREE.PerspectiveCamera(58, 1, 0.1, 100);
    camera.position.z = 16;

    /* Node colors echo the banner: gold, magenta, purple, soft white */
    var palette = [
      new THREE.Color(0xf0c868),
      new THREE.Color(0xc2339e),
      new THREE.Color(0x8a5cf6),
      new THREE.Color(0xdfe6ff)
    ];

    var isSmall = hero.clientWidth < 640;
    var COUNT = isSmall ? 55 : 100;
    var RADIUS = 9.5;
    var LINK_DIST = 4.1;

    var positions = new Float32Array(COUNT * 3);
    var colors = new Float32Array(COUNT * 3);
    var points3d = [];

    for (var i = 0; i < COUNT; i++) {
      /* Loose spherical shell distribution */
      var r = RADIUS * (0.45 + Math.random() * 0.6);
      var theta = Math.random() * Math.PI * 2;
      var phi = Math.acos(2 * Math.random() - 1);
      var x = r * Math.sin(phi) * Math.cos(theta);
      var y = r * Math.sin(phi) * Math.sin(theta) * 0.72;
      var z = r * Math.cos(phi) * 0.55;
      points3d.push(new THREE.Vector3(x, y, z));
      positions[i * 3] = x;
      positions[i * 3 + 1] = y;
      positions[i * 3 + 2] = z;
      var c = palette[Math.floor(Math.random() * palette.length)];
      colors[i * 3] = c.r;
      colors[i * 3 + 1] = c.g;
      colors[i * 3 + 2] = c.b;
    }

    var group = new THREE.Group();
    scene.add(group);

    /* Points */
    var pointGeo = new THREE.BufferGeometry();
    pointGeo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    pointGeo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    var points = new THREE.Points(
      pointGeo,
      new THREE.PointsMaterial({
        size: 0.22,
        vertexColors: true,
        transparent: true,
        opacity: 0.95,
        sizeAttenuation: true
      })
    );
    group.add(points);

    /* Lines between nearby nodes, rebuilt from the base positions */
    var linePositions = [];
    var lineColors = [];
    for (var a = 0; a < COUNT; a++) {
      for (var b = a + 1; b < COUNT; b++) {
        if (points3d[a].distanceTo(points3d[b]) < LINK_DIST) {
          linePositions.push(points3d[a].x, points3d[a].y, points3d[a].z);
          linePositions.push(points3d[b].x, points3d[b].y, points3d[b].z);
          var ca = palette[1];
          lineColors.push(ca.r, ca.g, ca.b, ca.r, ca.g, ca.b);
        }
      }
    }
    var lineGeo = new THREE.BufferGeometry();
    lineGeo.setAttribute("position", new THREE.Float32BufferAttribute(linePositions, 3));
    lineGeo.setAttribute("color", new THREE.Float32BufferAttribute(lineColors, 3));
    var lines = new THREE.LineSegments(
      lineGeo,
      new THREE.LineBasicMaterial({
        vertexColors: true,
        transparent: true,
        opacity: 0.28
      })
    );
    group.add(lines);

    /* A second, sparser star layer for depth */
    var starCount = isSmall ? 120 : 260;
    var starPos = new Float32Array(starCount * 3);
    for (var s = 0; s < starCount; s++) {
      starPos[s * 3] = (Math.random() - 0.5) * 46;
      starPos[s * 3 + 1] = (Math.random() - 0.5) * 28;
      starPos[s * 3 + 2] = -6 - Math.random() * 10;
    }
    var starGeo = new THREE.BufferGeometry();
    starGeo.setAttribute("position", new THREE.BufferAttribute(starPos, 3));
    var stars = new THREE.Points(
      starGeo,
      new THREE.PointsMaterial({ color: 0x9db2e8, size: 0.09, transparent: true, opacity: 0.7 })
    );
    scene.add(stars);

    /* Mouse parallax: target values, eased each frame */
    var targetX = 0;
    var targetY = 0;
    var currentX = 0;
    var currentY = 0;

    window.addEventListener("pointermove", function (e) {
      targetX = (e.clientX / window.innerWidth - 0.5) * 2;
      targetY = (e.clientY / window.innerHeight - 0.5) * 2;
    }, { passive: true });

    function resize() {
      var w = hero.clientWidth;
      var h = hero.clientHeight;
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    }
    window.addEventListener("resize", resize);
    resize();

    var clock = new THREE.Clock();
    var running = true;

    /* Pause when the hero is off screen */
    if ("IntersectionObserver" in window) {
      new IntersectionObserver(function (entries) {
        running = entries[0].isIntersecting;
      }).observe(hero);
    }

    function animate() {
      requestAnimationFrame(animate);
      if (!running) return;
      var t = clock.getElapsedTime();

      currentX += (targetX - currentX) * 0.045;
      currentY += (targetY - currentY) * 0.045;

      group.rotation.y = t * 0.045 + currentX * 0.45;
      group.rotation.x = currentY * 0.28 + Math.sin(t * 0.12) * 0.05;
      stars.rotation.z = t * 0.004;

      camera.position.x = currentX * 1.1;
      camera.position.y = -currentY * 0.7;
      camera.lookAt(scene.position);

      renderer.render(scene, camera);
    }

    if (reduceMotion) {
      renderer.render(scene, camera);
    } else {
      animate();
    }
  }

  /* ---------- Scroll reveal ---------- */

  function initReveal() {
    /* Reduced motion (or no IntersectionObserver): leave everything visible. */
    if (reduceMotion) return;
    if (!("IntersectionObserver" in window)) return;

    var targets = document.querySelectorAll(
      ".section-title, .section-intro, .card, .skill-list, .contact-links"
    );
    if (!targets.length) return;

    targets.forEach(function (el) {
      el.classList.add("reveal-pending");
    });

    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        var el = entry.target;
        el.classList.add("reveal-visible");
        el.classList.remove("reveal-pending");
        observer.unobserve(el);
        /* Clean up after the animation so card tilt transforms stay snappy. */
        setTimeout(function () {
          el.classList.remove("reveal-visible");
        }, 850);
      });
    }, { threshold: 0.12, rootMargin: "0px 0px -40px 0px" });

    targets.forEach(function (el) {
      observer.observe(el);
    });
  }

  initTilt();
  initHero();
  initReveal();
})();
