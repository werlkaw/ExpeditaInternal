  
import * as admin from 'firebase-admin';

const idMap = admin.database().ref('conektaStripeMap');

export function addEntry(conektaId: string, stripeId: string) {
    const conektaEntry = idMap.child(conektaId);
    conektaEntry.set({
        'stripeId': stripeId
    }).then((v) => {
        console.log("Realtime Database mapped conekta: " + conektaId + " to stripe: " + stripeId);
    }).catch();
}

export async function getStripeId(conektaId: string) {
    const conektaEntry = idMap.child(conektaId);
    const snapshot = await conektaEntry.once('value');
    if (snapshot.val()) {
        return snapshot.val()['stripeId'];
    } else {
        throw new Error("Conekta id: " + conektaId + " does not have an associated stripe customer");
    }
}