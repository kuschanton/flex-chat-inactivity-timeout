// Imports global types
import '@twilio-labs/serverless-runtime-types'
// Fetches specific types
import {
  Context,
  ServerlessCallback,
  ServerlessFunctionSignature,
} from '@twilio-labs/serverless-runtime-types/types'

type Env = {
  TIMEOUT: string
}

type OnReservationAccepted = {
  TaskAttributes: string,
}

export const handler: ServerlessFunctionSignature<Env, OnReservationAccepted> = async function (
  context: Context<Env>,
  event: OnReservationAccepted,
  callback: ServerlessCallback,
) {

  console.log(`https://${context.DOMAIN_NAME}/on_conversation_state_updated`)
  console.log(event)

  let taskAttributes = JSON.parse(event.TaskAttributes)
  let conversationSid = taskAttributes["conversationSid"]

  const response = new Twilio.Response()
  response.appendHeader('Content-Type', 'application/json')

  const conversationContext = context
    .getTwilioClient()
    .conversations
    // .services(taskAttributes["ChatServiceSid"])
    .conversations(conversationSid)

  // Create webhook
  try {
    await conversationContext
      .webhooks
      .create({
        target: 'webhook',
        configuration: {
          url: `https://${context.DOMAIN_NAME}/on_conversation_state_updated`,
          // url: `https://akushch.eu.ngrok.io/on_conversation_state_updated`,
          method: 'POST',
          filters: ['onConversationStateUpdated'],
        },
      })
  } catch (err) {
    console.error(err)
    response.setStatusCode(500)
    return callback(err, response)
  }

  // Set inactivity timeout
  try {
    await conversationContext
      .update({
        timers: {
          inactive: context.TIMEOUT,
        },
      })
  } catch (err) {
    console.error(err)
    response.setStatusCode(500)
    return callback(err, response)
  }

  console.log('OK')
  response.setStatusCode(200)
  response.setBody({
    ConversationSid: conversationSid,
  })
  return callback(null, response)
}