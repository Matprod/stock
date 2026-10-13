import Prompt from '#models_pg/prompt';
import { GPTService } from '#services/llm/gpt_service';
export default class OrchestratorService {
    llm = new GPTService();
    async summarize({ date, prompt, history, pieces, language, }) {
        const systemPrompt = await Prompt.findBy('title', 'orchestrator_system_prompt');
        if (!systemPrompt) {
            throw new Error('Prompt non trouvé');
        }
        let systemPromptContent = systemPrompt.content;
        systemPromptContent = 'Today is ' + date + '. ' + systemPromptContent;
        systemPromptContent = systemPromptContent.replaceAll('{{language}}', language === 'fr' ? 'French' : 'English');
        let dataPrompt = '';
        if (pieces.length > 0) {
            pieces.forEach((p) => {
                if (p.name === 'military_context') {
                    dataPrompt += `Military context:\n${p.content}\n\n Expert Responses:\n`;
                }
                else {
                    dataPrompt += `- ${p.name}:\n${p.content}\n`;
                }
            });
        }
        return this.llm.generateResponse({
            systemPrompt: systemPromptContent,
            dataPrompt,
            prompt,
            history,
        });
    }
}
//# sourceMappingURL=orchestrator_service.js.map