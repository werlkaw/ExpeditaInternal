export type MailEntry = {
    to: Array<string>,
    from: string,
    message: {
        text: string,
        html: string,
        subject: string,
        from?: string
    }
}

export class ExpeditaFirestore {
    private db: FirebaseFirestore.Firestore
    constructor(db: FirebaseFirestore.Firestore) {
        this.db = db
    }

    public addMailEntry(entry: MailEntry) {
        this.db.collection('mail').add(entry);
    }
    
}