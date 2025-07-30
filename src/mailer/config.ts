import path from "path";
import fs from 'fs/promises';

export interface IConfig {
    responseRating: number;
    specialRating: number;
    sendRating: number;
    waitTime: number;
    topic: string;
    attempts: number;
}


class MailerConfiguration implements IConfig {
    public responseRating: number;
    public specialRating: number;
    public sendRating: number;
    public waitTime: number;
    public topic: string;
    public attempts: number;


    private _path: string = path.join(process.cwd(), )
    constructor() {

    }

    public async save(): Promise<void> {
        await fs.writeFile(this._path, JSON.stringify(this), 'utf-8');
    }

    public async init(): Promise<void> {
        const conf: IConfig = JSON.parse(await fs.readFile(this._path, 'utf-8'));
        this.attempts = conf.attempts ?? 3;
        this.responseRating = conf.responseRating ?? 3;
        this.sendRating = conf.sendRating ?? 4;
        this.specialRating = conf.specialRating ?? 7;
        this.topic = conf.topic ?? 'Test';
        this.waitTime = conf.waitTime ?? 5;
    }

    public asConfig(): IConfig {
        return {
            attempts: this.attempts,
            crmRating: this.crmRating,
            responseRating: this.responseRating,
            sendRating: this.sendRating,
            specialRating: this.specialRating,
            topic: this.topic,
            waitTime: this.waitTime
        }
    }

}

export const config = new MailerConfiguration();