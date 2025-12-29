const videoElement = document.getElementById('input-video')
const handCanvas = document.getElementById('hand-canvas')
const ctx = handCanvas.getContext('2d')
const scoreEl = document.getElementById('score-val')
const distEl = document.getElementById('dist-val')
const loadingScreen = document.getElementById('loading-screen')

const badges = {
    left: document.getElementById('badge-left'),
    right: document.getElementById('badge-right'),
    jump: document.getElementById('badge-jump'),
    stop: document.getElementById('badge-stop')
}

let score = 0
let distance = 0
let inputState = { left: false, right: false, jump: false, stop: false }

const scene = new THREE.Scene()
scene.background = new THREE.Color(0x0f172a)
scene.fog = new THREE.Fog(0x0f172a, 15, 60)

const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000)
const renderer = new THREE.WebGLRenderer({ antialias: true })
renderer.setSize(window.innerWidth, window.innerHeight)
renderer.shadowMap.enabled = true
document.body.appendChild(renderer.domElement)

scene.add(new THREE.AmbientLight(0xffffff, 0.5))

const sun = new THREE.DirectionalLight(0xffffff, 1)
sun.position.set(10, 20, 10)
sun.castShadow = true
scene.add(sun)

const player = new THREE.Mesh(
    new THREE.BoxGeometry(1, 1, 1),
    new THREE.MeshPhongMaterial({ color: 0x10b981, emissive: 0x064e3b, emissiveIntensity: 0.2 })
)
player.castShadow = true
player.position.set(0, 2, 0)
scene.add(player)

let platforms = []
let coins = []
let hazards = []
let lastGeneratedX = -10
const GENERATION_THRESHOLD = 40

function createPlatform(x, y, w) {
    const mesh = new THREE.Mesh(
        new THREE.BoxGeometry(w, 1, 3),
        new THREE.MeshPhongMaterial({ color: 0x1e293b })
    )
    mesh.position.set(x, y, 0)
    mesh.receiveShadow = true
    scene.add(mesh)
    platforms.push({ mesh, x, y, w })
}

function createCoin(x, y) {
    const mesh = new THREE.Mesh(
        new THREE.TorusGeometry(0.3, 0.1, 8, 16),
        new THREE.MeshPhongMaterial({ color: 0xfacc15, emissive: 0x854d0e })
    )
    mesh.position.set(x, y + 1.2, 0)
    scene.add(mesh)
    coins.push(mesh)
}

function createHazard(x, y) {
    const mesh = new THREE.Mesh(
        new THREE.BoxGeometry(0.8, 0.8, 0.8),
        new THREE.MeshPhongMaterial({ color: 0xf43f5e, emissive: 0x9f1239 })
    )
    mesh.position.set(x, y + 0.9, 0)
    mesh.rotation.set(Math.PI / 4, 0, Math.PI / 4)
    scene.add(mesh)
    hazards.push(mesh)
}

function generateChunk() {
    const gap = 3 + Math.random() * 4
    const width = 6 + Math.random() * 8
    const heightVariation = (Math.random() - 0.5) * 4
    const newX = lastGeneratedX + width / 2 + gap
    const newY = Math.max(-3, Math.min(5, (platforms.at(-1)?.y || 0) + heightVariation))
    createPlatform(newX, newY, width)
    if (Math.random() > 0.3) createCoin(newX + (Math.random() - 0.5) * width * 0.6, newY)
    if (Math.random() > 0.6) createHazard(newX + (Math.random() - 0.5) * width * 0.6, newY)
    lastGeneratedX = newX + width / 2
}

createPlatform(0, -1, 15)
for (let i = 0; i < 5; i++) generateChunk()

let velocity = new THREE.Vector3()
const gravity = -0.015
const jumpStrength = 0.38
const moveSpeed = 0.18
let isGrounded = false

const hands = new Hands({
    locateFile: file => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`
})

hands.setOptions({
    maxNumHands: 1,
    modelComplexity: 1,
    minDetectionConfidence: 0.7,
    minTrackingConfidence: 0.7
})

hands.onResults(results => {
    if (loadingScreen.style.opacity !== '0') {
        loadingScreen.style.opacity = '0'
        setTimeout(() => loadingScreen.remove(), 500)
    }

    ctx.clearRect(0, 0, handCanvas.width, handCanvas.height)
    inputState = { left: false, right: false, jump: false, stop: false }

    if (results.multiHandLandmarks?.length) {
        const lm = results.multiHandLandmarks[0]
        drawConnectors(ctx, lm, HAND_CONNECTIONS, { color: '#10b981', lineWidth: 2 })
        drawLandmarks(ctx, lm, { color: '#fff', lineWidth: 1, radius: 2 })

        const isFist = lm[8].y > lm[6].y && lm[12].y > lm[10].y && lm[16].y > lm[14].y && lm[20].y > lm[18].y

        if (isFist) {
            inputState.stop = true
        } else {
            if (lm[8].y < lm[5].y - 0.12) inputState.jump = true
            if (lm[8].x < lm[5].x - 0.08) inputState.right = true
            else if (lm[8].x > lm[5].x + 0.08) inputState.left = true
        }
    }

    badges.left.className = `control-badge ${inputState.left ? 'active-ctrl' : 'inactive-ctrl'} text-center`
    badges.right.className = `control-badge ${inputState.right ? 'active-ctrl' : 'inactive-ctrl'} text-center`
    badges.jump.className = `control-badge ${inputState.jump ? 'active-ctrl' : 'inactive-ctrl'} text-center`
    badges.stop.className = `control-badge ${inputState.stop ? 'stop-ctrl' : 'inactive-ctrl'} text-center`
})

new Camera(videoElement, {
    onFrame: async () => await hands.send({ image: videoElement }),
    width: 640,
    height: 480
}).start()

function resetPlayer() {
    let rx = 0
    let ry = 2
    for (const p of platforms) {
        if (p.x < player.position.x) {
            rx = p.x
            ry = p.y + 2
        }
    }
    player.position.set(rx, ry, 0)
    velocity.set(0, 0, 0)
}

function update() {
    if (inputState.stop) velocity.x = 0
    else if (inputState.left) velocity.x = -moveSpeed
    else if (inputState.right) velocity.x = moveSpeed
    else velocity.x *= 0.85

    if (inputState.jump && isGrounded) {
        velocity.y = jumpStrength
        isGrounded = false
    }

    velocity.y += gravity
    player.position.add(velocity)

    distance = Math.max(distance, Math.floor(player.position.x))
    distEl.innerText = `${distance}m`

    if (player.position.x > lastGeneratedX - GENERATION_THRESHOLD) generateChunk()

    isGrounded = false
    platforms.forEach(p => {
        const hw = p.w / 2
        if (
            player.position.x > p.x - hw - 0.5 &&
            player.position.x < p.x + hw + 0.5 &&
            player.position.y > p.y + 0.5 &&
            player.position.y < p.y + 1.5 &&
            velocity.y < 0
        ) {
            player.position.y = p.y + 1
            velocity.y = 0
            isGrounded = true
        }
    })

    hazards.forEach(h => {
        h.rotation.y += 0.05
        h.scale.setScalar(1 + Math.sin(Date.now() * 0.01) * 0.1)
        if (player.position.distanceTo(h.position) < 1.2) resetPlayer()
    })

    coins.forEach((c, i) => {
        c.rotation.y += 0.05
        if (player.position.distanceTo(c.position) < 1.2) {
            scene.remove(c)
            coins.splice(i, 1)
            score++
            scoreEl.innerText = score
        }
    })

    if (player.position.y < -12) resetPlayer()

    const cleanupX = player.position.x - 30
    platforms = platforms.filter(p => p.x + p.w / 2 >= cleanupX || (scene.remove(p.mesh), false))
    coins = coins.filter(c => c.position.x >= cleanupX || (scene.remove(c), false))
    hazards = hazards.filter(h => h.position.x >= cleanupX || (scene.remove(h), false))

    camera.position.x += (player.position.x - camera.position.x) * 0.1
    camera.position.y += (player.position.y + 2 - camera.position.y) * 0.1
    camera.lookAt(player.position.x + 2, player.position.y, 0)

    renderer.render(scene, camera)
    requestAnimationFrame(update)
}

camera.position.set(0, 5, 15)
update()

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight
    camera.updateProjectionMatrix()
    renderer.setSize(window.innerWidth, window.innerHeight)
})
