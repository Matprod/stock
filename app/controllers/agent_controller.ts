import type { HttpContext } from '@adonisjs/core/http'
import AgentService, { createDbTool, createResponseStructureTool } from '#services/agent_service'
import { agentChatSchema } from '#schemas/agent'

export default class AgentController {
  private agentService = new AgentService()

  public async chat({ request, response }: HttpContext) {
    const { question } = await agentChatSchema.validate(request.body())

    const dbTool = await createDbTool(question)
    const result = await this.agentService.run(question, [dbTool, createResponseStructureTool()])

    return response.ok(result)
  }
}
