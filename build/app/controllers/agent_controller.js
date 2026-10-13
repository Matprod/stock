import AgentService, { createDbTool, createResponseStructureTool } from '#services/agent_service';
import { agentChatSchema } from '#schemas/agent';
export default class AgentController {
    agentService = new AgentService();
    async chat({ request, response }) {
        const { question } = await agentChatSchema.validate(request.body());
        const dbTool = await createDbTool(question);
        const result = await this.agentService.run(question, [dbTool, createResponseStructureTool()]);
        return response.ok(result);
    }
}
//# sourceMappingURL=agent_controller.js.map