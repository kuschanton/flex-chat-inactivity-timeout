// Imports global types
import '@twilio-labs/serverless-runtime-types'
// Fetches specific types
import {
  Context,
  ServerlessCallback,
  ServerlessFunctionSignature,
} from '@twilio-labs/serverless-runtime-types/types'

// Environment variables
type Env = {
  TASK_ROUTER_WORKSPACE: string
}

// Webhook event type with needed fields
type OnConversationStateUpdated = {
  ConversationSid: string,
  ChatServiceSid: string,
  StateTo: State,
  Reason: string
}

// Conversation state type
type State = 'active' | 'inactive'

export const handler: ServerlessFunctionSignature<Env, OnConversationStateUpdated> = async function (
  context: Context<Env>,
  event: OnConversationStateUpdated,
  callback: ServerlessCallback,
) {

  console.log(event)

  // Create a TwilioResponse object
  const response = new Twilio.Response()
  response.appendHeader('Content-Type', 'application/json')

  // We proceed only if both conditions are met event.StateTo === 'inactive' AND event.Reason === 'TIMER'
  if (event.StateTo !== 'inactive' || event.Reason !== 'TIMER') {
    // Nothing to do
    response.setStatusCode(200)
    return callback(null, response)
  }

  // Initialize Twilio client
  const client = context.getTwilioClient()

  // Fetch tasks for Conversation SID from the event
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

  // No tasks found or more than one task found, but both should never happen.
  if (tasks.length != 1) {
    response.setStatusCode(200)
    response.setBody({message: `Tasks found ${tasks.length}`})
    return callback(null, response)
  }

  // Variable to store task instance
  let task = tasks[0]

  // Completing task in TaskRouter
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

  // Send timeout notification to the customer
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

  // Update Conversation state to closed
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

  // Return success response
  console.log('OK')
  response.setStatusCode(200)
  response.setBody({
    ConversationSid: event.ConversationSid,
    TaskSid: task.sid,
  })
  return callback(null, response)

}

