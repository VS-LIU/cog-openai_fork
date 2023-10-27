/*tslint:disable:no-else-after-return*/

import { BaseStep, Field, StepInterface, ExpectedRecord } from '../../core/base-step';
import { Step, FieldDefinition, StepDefinition, RecordDefinition, StepRecord } from '../../proto/cog_pb';
import * as util from '@run-crank/utilities';
import { baseOperators } from '../../client/constants/operators';

export class CompletionSemanticSimilarity extends BaseStep implements StepInterface {

  protected stepName: string = 'Check OpenAI GPT semantic similarity of response to provided text from completion';
  // tslint:disable-next-line:max-line-length
  protected stepExpression: string = 'OpenAI model (?<model>[a-zA-Z0-9_-]+) response to (?<prompt>[a-zA-Z0-9_-]+) should (?<operator>be set|not be set|be less than|be greater than|be one of|be|contain|not be one of|not be|not contain|match|not match) ?(?<expectation>.+)?';
  protected stepType: StepDefinition.Type = StepDefinition.Type.VALIDATION;
  protected actionList: string[] = ['check'];
  protected targetObject: string = 'Completion';
  protected expectedFields: Field[] = [{
    field: 'prompt',
    type: FieldDefinition.Type.STRING,
    description: 'User Prompt to send to GPT',
  }, {
    field: 'model',
    type: FieldDefinition.Type.STRING,
    description: 'GPT Model to use for completion',
  }, {
    field: 'operator',
    type: FieldDefinition.Type.STRING,
    optionality: FieldDefinition.Optionality.OPTIONAL,
    description: 'Check Logic (be, not be, contain, not contain, be greater than, be less than, be set, not be set, be one of, or not be one of)',
  },
  {
    field: 'comparetext',
    type: FieldDefinition.Type.STRING,
    description: 'Expected text to compare to GPT response',
    optionality: FieldDefinition.Optionality.OPTIONAL,
  },
  {
    field: 'semanticsimilarity',
    type: FieldDefinition.Type.NUMERIC,
    description: 'Semantic Similarity Score',
    optionality: FieldDefinition.Optionality.OPTIONAL,
  }];

  protected expectedRecords: ExpectedRecord[] = [{
    id: 'completion',
    type: RecordDefinition.Type.KEYVALUE,
    fields: [{
      field: 'model',
      type: FieldDefinition.Type.STRING,
      description: 'Completion Model',
    }, {
      field: 'prompt',
      type: FieldDefinition.Type.STRING,
      description: 'Completion Prompt',
    }, {
      field: 'response',
      type: FieldDefinition.Type.STRING,
      description: 'Completion Model Response',
    }, {
      field: 'semanticsimilarity',
      type: FieldDefinition.Type.NUMERIC,
      description: 'Actual Semantic Similarity Score',
    }, {
      field: 'usage',
      type: FieldDefinition.Type.STRING,
      description: 'Completion Usage',
    }, {
      field: 'created',
      type: FieldDefinition.Type.NUMERIC,
      description: 'Completion Create Date',
    }],
    dynamicFields: true,
  }];

  async executeStep(step: Step) {
    const stepData: any = step.getData() ? step.getData().toJavaScript() : {};
    const compareText = stepData.comparetext;
    const prompt = stepData.prompt;
    const model = stepData.model;
    const expectedSimilarity = stepData.semanticsimilarity;
    const operator = stepData.operator || 'be';

    try {
      const messages = [];
      const message = {};
      message['role'] = 'user';
      message['content'] = prompt;
      messages.push(message);
      const completion = await this.client.getChatCompletion(model, messages);
      const response = completion.choices[0].message.content;
      const actual = this.client.getSemanticScore(response);
      const result = this.assert(operator, actual, expectedSimilarity, 'response');
      const returnObj = {
        model,
        prompt,
        response,
        semanticsimilarity: actual,
        usage: completion.usage,
        created: completion.created,
      };
      const records = this.createRecords(completion, stepData['__stepOrder']);
      return result.valid ? this.pass(result.message, [], records) : this.fail(result.message, [], records);
    } catch (e) {
      if (e instanceof util.UnknownOperatorError) {
        return this.error('%s Please provide one of: %s', [e.message, baseOperators.join(', ')]);
      }
      if (e instanceof util.InvalidOperandError) {
        return this.error('There was an error checking GTP chat completion object: %s', [e.message]);
      }

      return this.error('There was an error checking  GTP chat completion object: %s', [e.toString()]);
    }
  }

  public createRecords(completion, stepOrder = 1): StepRecord[] {
    const records = [];
    // Base Record
    records.push(this.keyValue('completion', 'Checked Semantic Similarity', completion));
    // Ordered Record
    records.push(this.keyValue(`completion.${stepOrder}`, `Checked Semantic Similarity from Step ${stepOrder}`, completion));
    return records;
  }
}

export { CompletionSemanticSimilarity as Step };
