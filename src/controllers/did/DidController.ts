import type { DidCreate, DidResolutionResultProps } from '../types'
import { DidCreateResult, DidOperationStateActionBase, JsonTransformer, KeyDidCreateOptions, KeyType, TypedArrayEncoder } from '@aries-framework/core'
import { Agent } from '@aries-framework/core'
import { Body, Controller, Example, Get, Path, Post, Res, Route, Tags, TsoaResponse } from 'tsoa'
import { injectable } from 'tsyringe'
import { IndySdkIndyDidRegistrar, IndySdkIndyDidResolver, IndySdkModuleConfig } from '@aries-framework/indy-sdk'
import { Did, DidRecordExample } from '../examples'
import * as IndySdk from 'indy-sdk';
import axios from 'axios';

@Tags('Dids')
@Route('/dids')
@injectable()
export class DidController extends Controller {
  private agent: Agent

  public constructor(agent: Agent) {
    super()
    this.agent = agent
  }

  /**
   * Resolves did and returns did resolution result
   * @param did Decentralized Identifier
   * @returns DidResolutionResult
   */
  @Example<DidResolutionResultProps>(DidRecordExample)
  @Get('/:did')
  public async getDidRecordByDid(@Path('did') did: Did) {
    const resolveResult = await this.agent.dids.resolve(did)

    if (!resolveResult.didDocument) {
      this.setStatus(500)
      return { resolveResult }
    }

    return { ...resolveResult, didDocument: resolveResult.didDocument.toJSON() }
  }

  /**
   * Did nym registration
   * @body DidCreateOptions
   * @returns DidResolutionResult
   */
  // @Example<DidResolutionResultProps>(DidRecordExample)

  @Post('/write')
  public async writeDid(
    @Body() data: DidCreate,
    @Res() internalServerError: TsoaResponse<500, { message: string }>) {
    try {
      let body = {
        role: 'ENDORSER',
        alias: 'Alias',
        seed: data.seed
      };
      console.log('Starting DID registration')
      return await axios
        .post('http://test.bcovrin.vonx.io/register', body)
        .then(async (res) => {
      console.log('hds DID registration')
          if (res.data) {
            await this.agent.dids.import({
              did: `did:indy:bcovrin:${res.data.did}`,
              overwrite: true,
              privateKeys: [
                {
                  keyType: KeyType.Ed25519,
                  privateKey: TypedArrayEncoder.fromString(data.seed),
                },
              ],
            })
            return { did: `did:indy:bcovrin:${res.data.did}` };
          }
        })
    }
    catch (error) {
      return internalServerError(500, { message: `something went wrong: ${error}` })

    }
  }

  @Post('/create-key-did')
  public async createDidKey(
    @Body() didOptions: DidCreate,
    @Res() internalServerError: TsoaResponse<500, { message: string }>
  ) {
    try {
      const did = await this.agent.dids.create<KeyDidCreateOptions>({
        method: 'key',
        options: {
          keyType: KeyType.Ed25519,
        },
        secret: {
          privateKey: TypedArrayEncoder.fromString(didOptions.seed)
        }
      });
      console.log('Did created using create-key-did API: ', did.didState.did);
      await this.agent.dids.import({
        did: `${did.didState.did}`,
        overwrite: true,
        privateKeys: [
          {
            keyType: KeyType.Ed25519,
            privateKey: TypedArrayEncoder.fromString(didOptions.seed),
          },
        ],
      });
      return { did: `${did.didState.did}` };
    } catch (error) {
      return internalServerError(500, { message: `something went wrong: ${error}` })
    }
  }

  @Get('/')
  public async getDids() {
    const createdDids = await this.agent.dids.getCreatedDids({})
    return createdDids;
  }
}

