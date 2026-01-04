import { ref, computed } from "vue";
import { 
  collection, 
  addDoc, 
  getDocs, 
  query, 
  orderBy,
  doc,
  updateDoc,
  deleteDoc,
  getDoc
} from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "./useAuth";

const { user } = useAuth();
const npcs = ref([]);
const loading = ref(false);
const error = ref(null);

// Получить всех NPC (всех пользователей, чтобы GM мог видеть все доступные шаблоны)
async function fetchNPCs() {
  if (!user.value) {
    npcs.value = [];
    return;
  }

  loading.value = true;
  error.value = null;

  try {
    const npcsRef = collection(db, "npcs");
    const q = query(
      npcsRef,
      orderBy("createdAt", "desc")
    );
    
    const querySnapshot = await getDocs(q);
    npcs.value = querySnapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
      };
    });
  } catch (err) {
    console.error("Error fetching NPCs:", err);
    error.value = err.message;
  } finally {
    loading.value = false;
  }
}

// Создать нового NPC
async function createNPC(npcData) {
  if (!user.value) {
    throw new Error("User must be authenticated");
  }

  loading.value = true;
  error.value = null;

  try {
    const npcsRef = collection(db, "npcs");
    
    const newNPC = {
      userId: user.value.uid,
      name: npcData.name,
      imageUrl: npcData.imageUrl,
      description: npcData.description || "",
      stats: {
        maxHitPoints: npcData.stats?.maxHitPoints || 50,
        agility: npcData.stats?.agility || 10,
        strength: npcData.stats?.strength || 10,
        intelligence: npcData.stats?.intelligence || 10,
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const docRef = await addDoc(npcsRef, newNPC);
    await fetchNPCs(); // Обновляем список
    return docRef.id;
  } catch (err) {
    console.error("Error creating NPC:", err);
    error.value = err.message;
    throw err;
  } finally {
    loading.value = false;
  }
}

// Обновить NPC
async function updateNPC(npcId, updates) {
  if (!user.value) {
    throw new Error("User must be authenticated");
  }

  loading.value = true;
  error.value = null;

  try {
    const npcRef = doc(db, "npcs", npcId);
    const npcDoc = await getDoc(npcRef);
    
    if (!npcDoc.exists()) {
      throw new Error("NPC not found");
    }

    const npcData = npcDoc.data();
    if (npcData.userId !== user.value.uid) {
      throw new Error("Permission denied");
    }

    await updateDoc(npcRef, {
      ...updates,
      updatedAt: new Date(),
    });

    await fetchNPCs(); // Обновляем список
  } catch (err) {
    console.error("Error updating NPC:", err);
    error.value = err.message;
    throw err;
  } finally {
    loading.value = false;
  }
}

// Удалить NPC
async function deleteNPC(npcId) {
  if (!user.value) {
    throw new Error("User must be authenticated");
  }

  loading.value = true;
  error.value = null;

  try {
    const npcRef = doc(db, "npcs", npcId);
    const npcDoc = await getDoc(npcRef);
    
    if (!npcDoc.exists()) {
      throw new Error("NPC not found");
    }

    const npcData = npcDoc.data();
    if (npcData.userId !== user.value.uid) {
      throw new Error("Permission denied");
    }

    await deleteDoc(npcRef);
    await fetchNPCs(); // Обновляем список
  } catch (err) {
    console.error("Error deleting NPC:", err);
    error.value = err.message;
    throw err;
  } finally {
    loading.value = false;
  }
}

// Получить NPC по ID (только для чтения)
async function getNPCById(npcId) {
  if (!user.value) {
    throw new Error("User must be authenticated");
  }

  if (!npcId) {
    return null;
  }

  try {
    const npcRef = doc(db, "npcs", npcId);
    const npcDoc = await getDoc(npcRef);
    
    if (!npcDoc.exists()) {
      return null;
    }

    const npcData = npcDoc.data();
    return {
      id: npcDoc.id,
      ...npcData,
    };
  } catch (err) {
    console.error("Error getting NPC:", err);
    error.value = err.message;
    throw err;
  }
}

export function useNPCs() {
  return {
    npcs: computed(() => npcs.value),
    loading: computed(() => loading.value),
    error: computed(() => error.value),
    fetchNPCs,
    createNPC,
    updateNPC,
    deleteNPC,
    getNPCById,
  };
}
