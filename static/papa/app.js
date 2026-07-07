const DEFAULT_STATE = {
  users: [
    { id: 'dad', name: '빵', role: 'parent', pin: '0000', avatarPrompt: 'a cheerful dad character shaped like a loaf of bread, warm friendly smile', avatarSeed: 501 },
    { id: 'mom', name: '오이', role: 'parent', pin: '0000', avatarPrompt: 'a cheerful mom character shaped like a cucumber, warm friendly smile', avatarSeed: 902 },
    { id: 'kid1', name: 'Sloth', role: 'kid', credits: 0, pin: '0000', avatarPrompt: 'a cute cartoon sloth character, relaxed cheerful expression', avatarSeed: 503 },
    { id: 'kid2', name: 'Golden Fly', role: 'kid', credits: 0, pin: '0000', avatarPrompt: 'a cute cartoon golden dragonfly character with shiny wings, cheerful expression', avatarSeed: 504 },
  ],
};

function buildImageUrl(desc, seed) {
  const prompt = 'cute flat vector sticker illustration of ' + desc + ', chore chart style, vibrant warm colors, simple clean background, no text, no words, family friendly';
  return 'https://image.pollinations.ai/prompt/' + encodeURIComponent(prompt) + '?width=512&height=512&nologo=true&seed=' + seed;
}

function buildAvatarUrl(prompt, seed) {
  const fullPrompt = 'simple cute anime style character icon portrait of ' + prompt + ', flat vector illustration, minimalist, clean line art, round friendly face, plain solid pastel background, no text, front facing, shoulders up';
  return 'https://image.pollinations.ai/prompt/' + encodeURIComponent(fullPrompt) + '?width=512&height=512&nologo=true&seed=' + seed;
}

function dollar(credits) {
  return (credits * 0.25).toFixed(2);
}

function statusMeta(status) {
  if (status === 'open') return { label: 'Open' };
  if (status === 'pending') return { label: 'Awaiting Approval' };
  if (status === 'completed') return { label: 'Completed' };
  if (status === 'approved') return { label: 'Approved' };
  return { label: 'Denied' };
}

function statusPillClass(status) {
  if (status === 'open') return 'status-pill status-open';
  if (status === 'pending') return 'status-pill status-pending';
  if (status === 'completed' || status === 'approved') return 'status-pill status-completed';
  return 'status-pill status-denied';
}

// Kept outside Alpine's reactive x-data object on purpose: Alpine deep-wraps
// everything in x-data in a reactivity Proxy, and the Firestore SDK's write
// methods (update/add/batch) rely on internal state tied to exact object
// identity — calling them through that Proxy silently breaks writes while
// reads keep working. A plain module-level variable is never proxied.
let db = null;

document.addEventListener('alpine:init', () => {
  Alpine.data('app', () => ({
    _seedChecked: false,

    users: [],
    assignments: [],
    cashouts: [],

    currentUserId: null,
    selectingUserId: null,
    pinInput: '',
    pinError: false,
    shakePin: false,

    showNewAssignment: false,
    newDescription: '',
    newCredits: 5,
    newAssignedTo: 'both',
    newImageUrl: '',
    newSeed: null,
    imageLoading: false,
    imageError: false,

    cashoutAmount: 1,

    settingsOpen: false,
    newPinValue: '',
    confirmPinValue: '',
    pinChangeError: '',

    celebration: null,

    init() {
      firebase.initializeApp(window.firebaseConfig);
      db = firebase.firestore();
      try { db.enablePersistence(); } catch (e) { /* multi-tab or unsupported browser; safe to ignore */ }

      firebase.auth().onAuthStateChanged((user) => {
        if (user) this.attachListeners();
      });
      firebase.auth().signInAnonymously().catch((e) => console.error('Firebase anonymous sign-in failed', e));
    },

    attachListeners() {
      db.collection('users').orderBy('order').onSnapshot((snap) => {
        this.users = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        this.maybeSeed();
      });
      db.collection('assignments').orderBy('createdAt', 'desc').onSnapshot((snap) => {
        this.assignments = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      });
      db.collection('cashouts').orderBy('createdAt', 'desc').onSnapshot((snap) => {
        this.cashouts = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      });
    },

    async maybeSeed() {
      if (this._seedChecked) return;
      this._seedChecked = true;
      try {
        const snap = await db.collection('users').limit(1).get();
        if (snap.empty) {
          const batch = db.batch();
          DEFAULT_STATE.users.forEach((u, i) => {
            const { id, ...rest } = u;
            batch.set(db.collection('users').doc(id), { ...rest, order: i });
          });
          await batch.commit();
        }
      } catch (e) {
        console.error('Failed to seed default users', e);
        this._seedChecked = false;
      }
    },

    userName(id) {
      const u = this.users.find(x => x.id === id);
      return u ? u.name : '';
    },

    avatarUrl(u) {
      return buildAvatarUrl(u.avatarPrompt || u.name, u.avatarSeed || 500);
    },

    dollar,

    // ---------- derived ----------

    get currentUser() {
      return this.users.find(u => u.id === this.currentUserId) || null;
    },
    get isSignedIn() { return !!this.currentUser; },
    get isSignedOut() { return !this.currentUser; },
    get isParent() { return this.currentUser ? this.currentUser.role === 'parent' : false; },
    get isKid() { return this.currentUser ? this.currentUser.role === 'kid' : false; },

    get selectingUser() {
      return this.selectingUserId ? this.users.find(u => u.id === this.selectingUserId) : null;
    },

    get kidsWithBalance() {
      return this.users.filter(u => u.role === 'kid');
    },

    get openAssignments() {
      return this.assignments.filter(a => a.status === 'open');
    },
    get pendingAssignments() {
      return this.assignments.filter(a => a.status === 'pending');
    },
    get completedAssignments() {
      return this.assignments.filter(a => a.status === 'completed').slice(0, 8);
    },

    assignedToLabel(a) {
      return a.assignedTo === 'both' ? 'Both kids' : this.userName(a.assignedTo);
    },
    completedByLabel(a) {
      return a.completedBy ? this.userName(a.completedBy) : '';
    },
    canMarkDone(a) {
      return this.isKid && a.status === 'open' && (a.assignedTo === 'both' || a.assignedTo === this.currentUser.id);
    },
    canApprove(a) {
      return this.isParent && a.status === 'pending';
    },

    get myBalancePill() {
      if (this.isKid && this.currentUser) {
        return '🪙 ' + (this.currentUser.credits || 0) + ' credits · $' + dollar(this.currentUser.credits || 0);
      }
      return null;
    },
    get myBalanceLabel() {
      if (this.isKid && this.currentUser) {
        return (this.currentUser.credits || 0) + ' credits · $' + dollar(this.currentUser.credits || 0);
      }
      return '';
    },

    get cashoutDollarPreview() { return dollar(this.cashoutAmount); },
    get newCreditsDollarPreview() { return dollar(this.newCredits); },

    get myCashouts() {
      if (!this.currentUser) return [];
      return this.cashouts.filter(c => c.kidId === this.currentUser.id);
    },
    get pendingCashouts() {
      return this.cashouts.filter(c => c.status === 'pending');
    },
    get resolvedCashouts() {
      return this.cashouts.filter(c => c.status !== 'pending').slice(0, 6);
    },
    cashoutDollar(c) { return dollar(c.credits); },
    statusLabel(status) { return statusMeta(status).label; },
    statusPillClass,

    creditPresets: [1, 2, 5, 10],

    get assignedToOptions() {
      return [{ value: 'both', label: 'Both Kids' }].concat(
        this.users.filter(u => u.role === 'kid').map(u => ({ value: u.id, label: u.name }))
      );
    },

    get addAssignmentDisabled() {
      return this.newDescription.trim().length === 0;
    },
    get generateButtonLabel() {
      if (this.imageLoading) return '🎨 Generating…';
      return this.newImageUrl ? '🎲 Regenerate image' : '🎲 Generate image';
    },

    taskImageUrl(a) { return buildImageUrl(a.description, a.seed); },

    // ---------- sign in ----------

    selectUser(id) {
      this.selectingUserId = id;
      this.pinInput = '';
      this.pinError = false;
    },
    cancelSelect() {
      this.selectingUserId = null;
      this.pinInput = '';
      this.pinError = false;
    },
    onPinInput(e) {
      const val = e.target.value.replace(/\D/g, '').slice(0, 4);
      this.pinInput = val;
      this.pinError = false;
      if (val.length === 4) {
        setTimeout(() => this.trySubmitPin(val), 80);
      }
    },
    trySubmitPin(overrideVal) {
      const val = overrideVal !== undefined ? overrideVal : this.pinInput;
      const user = this.users.find(u => u.id === this.selectingUserId);
      if (user && user.pin === val) {
        this.currentUserId = user.id;
        this.selectingUserId = null;
        this.pinInput = '';
        this.pinError = false;
      } else {
        this.pinError = true;
        this.pinInput = '';
        this.shakePin = true;
        setTimeout(() => { this.shakePin = false; }, 300);
      }
    },

    signOut() {
      this.currentUserId = null;
      this.selectingUserId = null;
    },

    // ---------- settings ----------

    openSettings() {
      this.settingsOpen = true;
      this.newPinValue = '';
      this.confirmPinValue = '';
      this.pinChangeError = '';
    },
    closeSettings() { this.settingsOpen = false; },
    savePin() {
      if (this.newPinValue.length !== 4) { this.pinChangeError = 'PIN must be 4 digits'; return; }
      if (this.newPinValue !== this.confirmPinValue) { this.pinChangeError = "PINs don't match"; return; }
      db.collection('users').doc(this.currentUserId).update({ pin: this.newPinValue })
        .then(() => { this.settingsOpen = false; })
        .catch((e) => {
          console.error('Failed to save PIN', e);
          this.pinChangeError = 'Could not save PIN — try again';
        });
    },

    // ---------- assignments ----------

    openNewAssignment() {
      this.showNewAssignment = true;
      this.newDescription = '';
      this.newCredits = 5;
      this.newAssignedTo = 'both';
      this.newImageUrl = '';
      this.newSeed = null;
      this.imageLoading = false;
      this.imageError = false;
    },
    closeNewAssignment() { this.showNewAssignment = false; },
    generateImage() {
      const desc = this.newDescription.trim() || 'a fun family chore';
      const seed = Math.floor(Math.random() * 1000000);
      this.newSeed = seed;
      this.imageLoading = true;
      this.imageError = false;
      this.newImageUrl = buildImageUrl(desc, seed);
    },
    onImageLoad() {
      this.imageLoading = false;
      this.imageError = false;
    },
    onImageError() {
      this.imageLoading = false;
      this.imageError = true;
    },
    addAssignment() {
      const desc = this.newDescription.trim();
      if (!desc) return;
      const seed = this.newSeed || Math.floor(Math.random() * 1000000);
      db.collection('assignments').add({
        description: desc,
        credits: this.newCredits,
        assignedTo: this.newAssignedTo,
        status: 'open',
        seed,
        createdBy: this.currentUserId,
        completedBy: null,
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      }).catch((e) => console.error('Failed to add assignment', e));
      this.showNewAssignment = false;
    },

    markDone(id) {
      db.collection('assignments').doc(id).update({
        status: 'pending',
        completedBy: this.currentUserId,
      }).catch((e) => console.error('Failed to mark assignment done', e));
    },

    approveAssignment(id) {
      const assignment = this.assignments.find(a => a.id === id);
      if (!assignment) return;
      const kidId = assignment.completedBy;
      const kid = this.users.find(u => u.id === kidId);

      const batch = db.batch();
      batch.update(db.collection('assignments').doc(id), { status: 'completed' });
      if (kidId) {
        batch.update(db.collection('users').doc(kidId), {
          credits: firebase.firestore.FieldValue.increment(assignment.credits),
        });
      }
      batch.commit().catch((e) => console.error('Failed to approve assignment', e));

      this.celebration = { name: kid ? kid.name : 'them', credits: assignment.credits };
      setTimeout(() => { this.celebration = null; }, 2400);
    },

    rejectAssignment(id) {
      db.collection('assignments').doc(id).update({
        status: 'open',
        completedBy: null,
      }).catch((e) => console.error('Failed to reject assignment', e));
    },

    // ---------- cashouts ----------

    requestCashout() {
      const kid = this.currentUser;
      if (!kid) return;
      const amount = this.cashoutAmount;
      if (amount < 1 || amount > (kid.credits || 0)) return;
      db.collection('cashouts').add({
        kidId: kid.id,
        credits: amount,
        status: 'pending',
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      }).catch((e) => console.error('Failed to request cash-out', e));
      this.cashoutAmount = 1;
    },
    approveCashout(id) {
      const req = this.cashouts.find(c => c.id === id);
      if (!req) return;
      const batch = db.batch();
      batch.update(db.collection('cashouts').doc(id), { status: 'approved' });
      batch.update(db.collection('users').doc(req.kidId), {
        credits: firebase.firestore.FieldValue.increment(-req.credits),
      });
      batch.commit().catch((e) => console.error('Failed to approve cash-out', e));
    },
    denyCashout(id) {
      db.collection('cashouts').doc(id).update({ status: 'denied' })
        .catch((e) => console.error('Failed to deny cash-out', e));
    },
  }));
});
