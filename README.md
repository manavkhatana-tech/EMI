<!DOCTYPE html>
<html lang="gu">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=no">
  <title>Firebase 3D World (Player & LLAMA Bot)</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; user-select: none; }
    body, html { width: 100%; height: 100%; overflow: hidden; background: #87ceeb; font-family: sans-serif; }
    #canvas { width: 100%; height: 100%; display: block; }
    
    #crosshair {
      position: absolute; top: 50%; left: 50%; width: 16px; height: 16px;
      transform: translate(-50%, -50%); pointer-events: none; z-index: 10;
    }
    #crosshair::before, #crosshair::after { content: ''; position: absolute; background: white; box-shadow: 0 0 2px black; }
    #crosshair::before { top: 7px; left: 0; width: 16px; height: 2px; }
    #crosshair::after { top: 0; left: 7px; width: 2px; height: 16px; }

    #ui {
      position: absolute; top: 10px; left: 10px; z-index: 20;
      background: rgba(0, 0, 0, 0.6); color: white; padding: 10px 15px; border-radius: 8px; font-size: 13px;
    }

    .controls { position: absolute; bottom: 20px; left: 20px; display: grid; grid-template-columns: repeat(3, 45px); gap: 5px; z-index: 20; }
    .btn { background: rgba(0,0,0,0.5); border: 2px solid #fff; color: white; font-weight: bold; border-radius: 6px; display: flex; align-items: center; justify-content: center; }
    #btnUp { grid-column: 2; } #btnLeft { grid-column: 1; grid-row: 2; } #btnDown { grid-column: 2; grid-row: 2; } #btnRight { grid-column: 3; grid-row: 2; }
    
    .actions { position: absolute; bottom: 20px; right: 20px; display: flex; flex-direction: column; gap: 8px; z-index: 20; }
    .act-btn { width: 65px; height: 45px; background: #007bff; border: 2px solid white; color: white; font-weight: bold; border-radius: 6px; }
  </style>

  <!-- Three.js & Firebase JS SDKs -->
  <script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"></script>
  <script src="https://www.gstatic.com/firebasejs/8.10.1/firebase-app.js"></script>
  <script src="https://www.gstatic.com/firebasejs/8.10.1/firebase-database.js"></script>
</head>
<body>

  <div id="crosshair"></div>

  <div id="ui">
    <b>🌐 Firebase World:</b> <span id="status" style="color:#00ff00">Connecting...</span><br>
    🆔 <b>Your ID:</b> <span id="myId">...</span><br>
    👥 Active Entities: <span id="entityCount">0</span>
  </div>

  <div class="controls">
    <div class="btn" id="btnUp">▲</div>
    <div class="btn" id="btnLeft">◀</div>
    <div class="btn" id="btnDown">▼</div>
    <div class="btn" id="btnRight">▶</div>
  </div>

  <div class="actions">
    <button class="act-btn" id="btnJump">JUMP</button>
  </div>

  <canvas id="canvas"></canvas>

  <script>
    // 1. FIREBASE CONFIGURATION (તમારી Firebase ની કીઝ અહીં મુકવી)
    const firebaseConfig = {
      apiKey: "YOUR_API_KEY",
      authDomain: "YOUR_PROJECT.firebaseapp.com",
      databaseURL: "https://YOUR_PROJECT-default-rtdb.firebaseio.com",
      projectId: "YOUR_PROJECT",
      storageBucket: "YOUR_PROJECT.appspot.com",
      messagingSenderId: "SENDER_ID",
      appId: "APP_ID"
    };
    firebase.initializeApp(firebaseConfig);
    const db = firebase.database();

    const myPlayerId = "player_" + Math.floor(Math.random() * 10000);
    document.getElementById('myId').innerText = myPlayerId;

    // 2. THREE.JS SCENE SETUP
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x87ceeb);

    const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    const renderer = new THREE.WebGLRenderer({ canvas: document.getElementById('canvas'), antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);

    scene.add(new THREE.AmbientLight(0xffffff, 0.6));
    const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
    dirLight.position.set(10, 20, 10);
    scene.add(dirLight);

    // Blocky World Materials
    const blockGeom = new THREE.BoxGeometry(1, 1, 1);
    const materials = {
      grass: new THREE.MeshLambertMaterial({ color: 0x4e9f3d }),
      wood: new THREE.MeshLambertMaterial({ color: 0x8b5a2b }),
      leaves: new THREE.MeshLambertMaterial({ color: 0x2e8b57 }),
      player: new THREE.MeshLambertMaterial({ color: 0x0000ff }),
      llamaBot: new THREE.MeshLambertMaterial({ color: 0xff0000 })
    };

    // Ground Generation
    for (let x = -10; x <= 10; x++) {
      for (let z = -10; z <= 10; z++) {
        const mesh = new THREE.Mesh(blockGeom, materials.grass);
        mesh.position.set(x, 0, z);
        scene.add(mesh);
        // Simple Trees
        if (Math.random() < 0.02 && Math.abs(x) > 2) {
          for(let y=1; y<=3; y++) {
            const woodMesh = new THREE.Mesh(blockGeom, y===3 ? materials.leaves : materials.wood);
            woodMesh.position.set(x, y, z);
            scene.add(woodMesh);
          }
        }
      }
    }

    // 3. FIREBASE REALTIME ENTITIES SYNC
    const entities = {};

    db.ref('world/entities').on('value', (snapshot) => {
      const data = snapshot.val() || {};
      document.getElementById('entityCount').innerText = Object.keys(data).length;

      Object.keys(data).forEach((id) => {
        if (id === myPlayerId) return; // Skip local player object rendering

        const entData = data[id];
        if (!entities[id]) {
          // LLAMA Bot માટે Red અને અન્ય Player માટે Blue Mesh
          const isBot = entData.isBot || id.includes('llama') || id.includes('bot');
          const mesh = new THREE.Mesh(new THREE.BoxGeometry(0.8, 1.8, 0.8), isBot ? materials.llamaBot : materials.player);
          scene.add(mesh);
          entities[id] = mesh;
        }
        entities[id].position.set(entData.x, entData.y, entData.z);
      });

      // Removals
      Object.keys(entities).forEach((id) => {
        if (!data[id]) {
          scene.remove(entities[id]);
          delete entities[id];
        }
      });
    });

    // Clean disconnect
    db.ref(`world/entities/${myPlayerId}`).onDisconnect().remove();

    // 4. CONTROLS & PHYSICS
    const player = { pos: new THREE.Vector3(0, 1.8, 0), velY: 0, onGround: false };
    camera.position.copy(player.pos);

    let yaw = 0, pitch = 0, isDragging = false, lastX = 0, lastY = 0;
    const canvasEl = document.getElementById('canvas');

    canvasEl.addEventListener('touchstart', (e) => { isDragging = true; lastX = e.touches[0].clientX; lastY = e.touches[0].clientY; });
    canvasEl.addEventListener('touchmove', (e) => {
      if (!isDragging) return;
      yaw -= (e.touches[0].clientX - lastX) * 0.005;
      pitch -= (e.touches[0].clientY - lastY) * 0.005;
      pitch = Math.max(-1.5, Math.min(1.5, pitch));
      lastX = e.touches[0].clientX; lastY = e.touches[0].clientY;
    });
    canvasEl.addEventListener('touchend', () => isDragging = false);

    const keys = { w: false, a: false, s: false, d: false };
    function bindBtn(id, key) {
      const el = document.getElementById(id);
      el.addEventListener('touchstart', (e) => { e.preventDefault(); keys[key] = true; });
      el.addEventListener('touchend', (e) => { e.preventDefault(); keys[key] = false; });
    }
    bindBtn('btnUp', 'w'); bindBtn('btnDown', 's'); bindBtn('btnLeft', 'a'); bindBtn('btnRight', 'd');

    document.getElementById('btnJump').addEventListener('click', () => {
      if (player.onGround) { player.velY = 0.2; player.onGround = false; }
    });

    // 5. GAME LOOP & FIREBASE UPDATE
    let lastPushTime = 0;
    function animate() {
      requestAnimationFrame(animate);

      const euler = new THREE.Euler(pitch, yaw, 0, 'YXZ');
      camera.quaternion.setFromEuler(euler);

      const fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion); fwd.y = 0; fwd.normalize();
      const side = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion); side.y = 0; side.normalize();

      if (keys.w) player.pos.addScaledVector(fwd, 0.1);
      if (keys.s) player.pos.addScaledVector(fwd, -0.1);
      if (keys.d) player.pos.addScaledVector(side, 0.1);
      if (keys.a) player.pos.addScaledVector(side, -0.1);

      player.velY -= 0.008;
      player.pos.y += player.velY;
      if (player.pos.y <= 1.8) { player.pos.y = 1.8; player.velY = 0; player.onGround = true; }

      camera.position.copy(player.pos);

      // Push position to Firebase every 100ms
      const now = Date.now();
      if (now - lastPushTime > 100) {
        db.ref(`world/entities/${myPlayerId}`).set({
          x: Number(player.pos.x.toFixed(2)),
          y: Number(player.pos.y.toFixed(2)),
          z: Number(player.pos.z.toFixed(2)),
          isBot: false
        });
        lastPushTime = now;
      }

      renderer.render(scene, camera);
    }
    animate();
  </script>
</body>
</html>
