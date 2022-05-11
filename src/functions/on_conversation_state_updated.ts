// Imports global types
import '@twilio-labs/serverless-runtime-types'
// Fetches specific types
import {
  Context,
  ServerlessCallback,
  ServerlessFunctionSignature,
} from '@twilio-labs/serverless-runtime-types/types'

type Env = {
  TASK_ROUTER_WORKSPACE: string
}


type OnConversationStateUpdated = {
  ConversationSid: string,
  ChatServiceSid: string,
  StateTo: State,
  Reason: string
}

type State = 'active' | 'inactive'

export const handler: ServerlessFunctionSignature<Env, OnConversationStateUpdated> = async function (
  context: Context<Env>,
  event: OnConversationStateUpdated,
  callback: ServerlessCallback,
) {

  console.log(event)

  const response = new Twilio.Response()
  response.appendHeader('Content-Type', 'application/json')

  if (event.StateTo !== 'inactive' || event.Reason !== 'TIMER') {
    // Nothing to do
    response.setStatusCode(200)
    return callback(null, response)
  }
  // We proceed only if both conditions are met event.StateTo === 'inactive' AND event.Reason === 'TIMER'

  const client = context.getTwilioClient()

  // Get tasks for Conversations
  let tasks
  try {
    tasks = await client.taskrouter
      .workspaces(context.TASK_ROUTER_WORKSPACE)
      .tasks
      .list({
          evaluateTaskAttributes: `conversationSid="${event.ConversationSid}"`,
        },
      )
  } catch (err) {
    console.error(err)
    response.setStatusCode(500)
    return callback(err, response)
  }

  if (tasks.length != 1) {
    // No tasks (or more than one, but this should never happen)
    response.setStatusCode(200)
    response.setBody({message: `Tasks found ${tasks.length}`})
    return callback(null, response)
  }

  let task = tasks[0]

  // Complete task
  try {
    await client.taskrouter
      .workspaces(context.TASK_ROUTER_WORKSPACE)
      .tasks(task.sid)
      .update({
        assignmentStatus: 'completed',
      })
  } catch (err) {
    console.error(err)
    response.setStatusCode(500)
    return callback(err, response)
  }

  // Send timeout notification
  try {
    await client.conversations
      .conversations(event.ConversationSid)
      .messages
      .create({
        body: 'Your session is timed out'
      })
  } catch (err) {
    console.error(err)
    response.setStatusCode(500)
    return callback(err, response)
  }

  // Set conversation to closed
  try {
    await client.conversations
      .conversations(event.ConversationSid)
      .update({
        state: 'closed',
      })
  } catch (err) {
    console.error(err)
    response.setStatusCode(500)
    return callback(err, response)
  }

  console.log('OK')
  response.setStatusCode(200)
  response.setBody({
    ConversationSid: event.ConversationSid,
    TaskSid: task.sid,
  })
  return callback(null, response)

}

