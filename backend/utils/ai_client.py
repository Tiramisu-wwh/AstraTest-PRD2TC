import httpx
import json
import re
import logging
import ast
from typing import List, Dict, Any, Optional
from datetime import datetime
from models import AIConfiguration

def estimate_token_count(text: str) -> int:
    """估算文本的token数量（粗略估算）"""
    # 中文字符通常一个字符约等于2个token
    # 英文字符通常4个字符约等于1个token
    chinese_chars = len(re.findall(r'[\u4e00-\u9fff]', text))
    english_chars = len(re.findall(r'[a-zA-Z]', text))

    chinese_tokens = chinese_chars * 2
    english_tokens = english_chars / 4

    return int(chinese_tokens + english_tokens)

def smart_split_content(content: str, max_tokens: int = 3000) -> List[str]:
    """
    智能分块函数，按照标题和段落边界分割内容
    """
    # 估算token
    total_tokens = estimate_token_count(content)

    if total_tokens <= max_tokens:
        return [content]

    # 按标题分割
    sections = []
    current_section = ""
    current_tokens = 0

    # 使用正则表达式匹配标题（支持多种格式）
    lines = content.split('\n')

    for line in lines:
        line_tokens = estimate_token_count(line)

        # 检查是否是标题行（包含标题标识或数字编号）
        is_heading = (
            line.startswith('[标题') or  # 我们的格式
            re.match(r'^(第\d+[章节篇]|[一二三四五六七八九十]+[、.]|\d+[、.])', line.strip()) or  # 中文编号
            re.match(r'^#{1,6}\s+', line.strip()) or  # Markdown格式
            re.match(r'^[A-Z][a-zA-Z\s]{1,50}[：:]', line.strip()) or  # 英文标题
            (len(line.strip()) < 50 and (line.strip().endswith('：') or line.strip().endswith(':')))  # 短行以冒号结尾
        )

        # 如果当前部分加上新行会超过限制，且遇到了标题，就分割
        if current_tokens + line_tokens > max_tokens and (is_heading or current_tokens > max_tokens * 0.8):
            if current_section.strip():
                sections.append(current_section.strip())
            current_section = line + "\n"
            current_tokens = line_tokens
        else:
            current_section += line + "\n"
            current_tokens += line_tokens

    # 添加最后一部分
    if current_section.strip():
        sections.append(current_section.strip())

    # 如果还是太大，就按段落强制分割
    final_sections = []
    for section in sections:
        if estimate_token_count(section) > max_tokens * 1.2:
            # 强制按段落分割
            paragraphs = section.split('\n\n')
            current_part = ""
            current_tokens = 0

            for para in paragraphs:
                para_tokens = estimate_token_count(para)
                if current_tokens + para_tokens > max_tokens:
                    if current_part.strip():
                        final_sections.append(current_part.strip())
                    current_part = para + "\n\n"
                    current_tokens = para_tokens
                else:
                    current_part += para + "\n\n"
                    current_tokens += para_tokens

            if current_part.strip():
                final_sections.append(current_part.strip())
        else:
            final_sections.append(section)

    return final_sections

async def analyze_with_ai_enhanced(content: str, ai_config: AIConfiguration, progress_callback=None, file_name=None) -> tuple[List[Dict[str, Any]], str]:
    """
    增强版AI分析函数，支持大文档分块分析
    返回：(测试用例列表, 整体分析建议)
    """
    try:
        # 估算token数量
        total_tokens = estimate_token_count(content)
        logging.info(f"文档总token数估算: {total_tokens}")

        # 如果内容较小，直接使用原始方法
        if total_tokens <= 3000:
            test_cases = await analyze_with_ai(content, ai_config)
            # 为小文档生成简单的分析建议
            analysis_suggestions = "建议进行全面的功能测试，覆盖所有业务流程和异常情况。"
            return test_cases, analysis_suggestions

        # 大文档分块处理
        chunks = smart_split_content(content, max_tokens=3500)  # 增加token限制，减少过度分割
        logging.info(f"文档被分割为 {len(chunks)} 个块进行分析")

        all_test_cases = []
        all_analysis_suggestions = []

        for i, chunk in enumerate(chunks):
            if progress_callback:
                progress_callback(f"正在分析第 {i+1}/{len(chunks)} 部分...")

            logging.info(f"分析第 {i+1} 个块，大小: {estimate_token_count(chunk)} tokens")

            # 为每个块生成专门的提示词 - 增强版，重点强调分析建议，适配Excel模板格式
            chunk_prompt = f"""
请详细分析以下产品需求文档片段，并生成符合Excel模板格式的全面、详细的测试用例和针对这部分内容的专门测试建议。

这是第 {i+1} 部分（共 {len(chunks)} 部分），请重点关注这部分的功能需求、业务逻辑和技术实现细节。

文档内容片段：
{chunk}

请按照以下格式返回JSON对象，必须包含测试用例数组和这部分的专门分析建议：

```json
{{
  "test_cases": [
    {{
      "title": "测试用例标题（*必填）",
      "group_name": "所属分组（选填，用|分隔层级，如：Web端测试用例|首页|我的待办）",
      "maintainer": "维护人（选填，成员姓名）",
      "precondition": "前置条件（选填，执行测试前的必要条件）",
      "step_description": "步骤描述（选填，使用【1】、【2】等编号格式，每个步骤一行）",
      "expected_result": "预期结果（选填，每个步骤对应的预期结果，与步骤编号对应）",
      "case_level": "用例等级（选填：高/中/低，默认：中）",
      "case_type": "用例类型（选填：功能测试/性能测试/安全测试/兼容性测试，默认：功能测试）",
      "test_suggestions": "针对此测试用例的具体建议，如测试数据准备、注意事项、关联测试等"
    }}
  ],
  "analysis_suggestions": "针对这部分文档内容的专门测试策略分析和建议"
}}
```

**重要要求**（严格按照Excel模板格式）：

1. **测试用例生成**（遵循Teambition导入规范）：
   - 针对这部分文档内容生成详细的测试用例
   - 测试用例必须覆盖所有功能点、业务场景、边界条件和异常情况
   - 包括但不限于：正常流程、异常流程、边界值、数据验证、权限控制等
   - **步骤描述格式**：必须使用【1】、【2】、【3】等中文编号格式，每个步骤单独一行
   - **预期结果格式**：与步骤描述对应，使用相同的【1】、【2】、【3】编号格式
   - **分组格式**：使用"|"分隔层级，如"Web端测试用例|首页|我的待办"
   - **必填规则**：只有"title"是必填项，其他字段选填但建议尽可能完整
   - 区分不同优先级：核心业务（高）、主要功能（中）、非核心功能（低）
   - 包含多种测试类型：功能测试、性能测试、安全测试、兼容性测试等
   - 如果这部分有多个功能模块，每个模块都要有对应的测试用例
   - 考虑用户操作的各种可能性和错误场景
   - 为每个测试用例提供具体的测试建议

2. **分析建议生成**（重点关注）：
   - **必须**在"analysis_suggestions"字段中，提供针对这部分文档内容的专门测试策略分析
   - 分析这部分功能的技术特点和业务逻辑
   - 指出这部分功能的潜在风险点和测试难点
   - 推荐针对这部分功能的专门测试方法和测试工具
   - 说明这部分功能与其他模块的依赖关系和集成测试要点
   - 提供这部分功能的测试数据准备建议
   - 分析这部分功能的性能和安全测试要点

3. **内容针对性**：
   - 分析建议必须基于这部分文档的具体内容，不能是通用模板
   - 要体现对这部分业务逻辑和技术实现的深入理解
   - 提供实用的、可操作的测试指导建议

**Excel模板格式要求**：
- 确保生成的JSON格式完全正确
- 所有字段都必须有值，不能有空值或缺失字段（选填字段可以为空字符串）
- 测试用例必须包含所有必需字段
- analysis_suggestions字段必须包含有价值的分析内容，不能留空
- 步骤描述和预期结果必须使用【1】、【2】、【3】的中文编号格式
- 分组名称使用"|"分隔多个层级

请直接返回JSON对象，不要包含其他文本。确保JSON格式正确且无语法错误。
            """

            try:
                chunk_result = await analyze_chunk_with_ai_new(chunk_prompt, ai_config)
                if chunk_result and isinstance(chunk_result, dict) and "test_cases" in chunk_result:
                    all_test_cases.extend(chunk_result["test_cases"])
                    # 收集分析建议
                    if "analysis_suggestions" in chunk_result and chunk_result["analysis_suggestions"]:
                        all_analysis_suggestions.append(chunk_result["analysis_suggestions"])
                    logging.info(f"第 {i+1} 个块分析完成，生成 {len(chunk_result['test_cases'])} 个测试用例")
                elif isinstance(chunk_result, list):  # 兼容旧格式
                    all_test_cases.extend(chunk_result)
                    logging.info(f"第 {i+1} 个块分析完成，生成 {len(chunk_result)} 个测试用例")
                else:
                    logging.warning(f"第 {i+1} 个块未生成测试用例，继续处理下一个块")
            except Exception as e:
                logging.error(f"第 {i+1} 个块分析失败: {str(e)}，继续处理下一个块")
                continue

        # 去重和优化
        unique_cases = deduplicate_test_cases(all_test_cases)
        logging.info(f"分析完成，共生成 {len(unique_cases)} 个去重后的测试用例")

        # 合并所有分析建议 - 使用AI生成的建议，如果没有则生成简单的提示
        if all_analysis_suggestions:
            # 使用AI生成的分析建议
            combined_suggestions = "\n\n".join(all_analysis_suggestions)
            logging.info(f"使用AI生成的分析建议，共 {len(all_analysis_suggestions)} 条")
        else:
            # 只有在AI确实没有生成任何建议时才使用简单的提示
            combined_suggestions = f"""
基于对《{file_name or '当前文档'}》的分析，AI已为您生成了 {len(unique_cases)} 个详细的测试用例。

文档分析完成，请查看具体的测试用例以获取针对本PRD的详细测试建议。
每个测试用例都包含了具体的测试建议，可帮助您更好地执行测试。
"""
            logging.info("AI未生成整体分析建议，使用简单提示")

        if progress_callback:
            progress_callback("分析完成，正在优化结果...")

        return unique_cases, combined_suggestions

    except Exception as e:
        logging.error(f"增强版AI分析错误: {str(e)}")
        # 直接抛出异常，不再返回默认测试用例
        raise Exception(f"AI分析失败: {str(e)}")

async def analyze_chunk_with_ai_new(prompt: str, ai_config: AIConfiguration) -> Dict[str, Any]:
    """分析单个块的AI请求"""
    try:
        request_data = {
            "model": ai_config.model_name,
            "messages": [
                {
                    "role": "user",
                    "content": prompt
                }
            ],
            "temperature": 0.8,  # 提高温度以增加多样性
            "max_tokens": 3000  # 增加token限制，允许生成更多测试用例
        }

        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {ai_config.api_key}"
        }

        async with httpx.AsyncClient(timeout=60.0) as client:
            response = await client.post(
                ai_config.api_endpoint + "/chat/completions",
                json=request_data,
                headers=headers
            )

        if response.status_code != 200:
            error_msg = f"AI API请求失败: {response.status_code} - {response.text}"
            logging.error(error_msg)
            raise Exception(error_msg)

        result = response.json()

        if "choices" not in result or not result["choices"]:
            error_msg = "AI返回结果格式错误：缺少choices字段"
            logging.error(error_msg)
            raise Exception(error_msg)

        ai_response = result["choices"][0]["message"]["content"].strip()

        # 记录AI响应的详细信息用于调试
        logging.info(f"AI响应内容预览: {ai_response[:500]}...")
        logging.info(f"AI响应完整长度: {len(ai_response)} 字符")
        logging.info(f"AI响应前50字符: {repr(ai_response[:50])}")
        logging.info(f"AI响应后50字符: {repr(ai_response[-50:])}")

        # 强制记录完整的AI响应到单独的文件用于调试
        with open('/tmp/ai_response_debug.log', 'a', encoding='utf-8') as f:
            f.write(f"\n\n=== AI响应完整内容 ===\n")
            f.write(f"时间: {datetime.now()}\n")
            f.write(f"长度: {len(ai_response)}\n")
            f.write(f"内容: {repr(ai_response)}\n")
            f.write(f"原始内容:\n{ai_response}\n")
            f.write(f"字符分析:\n")
            f.write(f"  第一个字符: {repr(ai_response[0]) if ai_response else '空'} (ord: {ord(ai_response[0]) if ai_response else 'N/A'})\n")
            f.write(f"  最后一个字符: {repr(ai_response[-1]) if ai_response else '空'} (ord: {ord(ai_response[-1]) if ai_response else 'N/A'})\n")
            f.write(f"  是否以[开头: {ai_response.startswith('[') if ai_response else False}\n")
            f.write(f"  是否以]结尾: {ai_response.endswith(']') if ai_response else False}\n")
            # 尝试手动验证JSON格式
            try:
                json.loads(ai_response)
                f.write(f"  手动JSON验证: 成功\n")
            except Exception as json_e:
                f.write(f"  手动JSON验证: 失败 - {json_e}\n")

        # 检查是否包含特定的markdown标记
        if '```json' in ai_response:
            logging.info("发现```json标记")
        if '```' in ai_response:
            logging.info("发现```标记")
        if ai_response.strip().startswith('['):
            logging.info("AI响应以[开头")
        if ai_response.strip().endswith(']'):
            logging.info("AI响应以]结尾")

        # 解析JSON响应 - 简化和强化的提取逻辑
        logging.info("开始JSON解析过程")

        # 方法1: 直接尝试解析整个响应
        try:
            result = json.loads(ai_response)
            if isinstance(result, dict) and "test_cases" in result:
                logging.info("直接JSON解析成功 - 新格式")
                return result
            elif isinstance(result, list):
                logging.info("直接JSON解析成功 - 旧格式")
                return {"test_cases": result, "analysis_suggestions": ""}
        except Exception as e:
            logging.info(f"直接JSON解析失败: {e}")
            logging.info(f"失败时的响应类型: {type(ai_response)}")
            logging.info(f"响应长度: {len(ai_response)}")
            logging.info(f"响应前100字符: {repr(ai_response[:100])}")
            logging.info(f"响应后100字符: {repr(ai_response[-100:])}")

        # 方法2: 提取```json代码块
        try:
            # 查找```json标记
            json_start = ai_response.find('```json')
            if json_start != -1:
                json_start += 7  # 跳过"```json"
                json_end = ai_response.find('```', json_start)
                if json_end != -1:
                    json_content = ai_response[json_start:json_end].strip()
                    result = json.loads(json_content)
                    if isinstance(result, dict) and "test_cases" in result:
                        logging.info("```json代码块解析成功 - 新格式")
                        return result
                    elif isinstance(result, list):
                        logging.info("```json代码块解析成功 - 旧格式")
                        return {"test_cases": result, "analysis_suggestions": ""}
        except Exception as e:
            logging.info(f"```json代码块解析失败: {e}")

        # 方法3: 提取任何```代码块中的JSON
        try:
            code_start = ai_response.find('```')
            if code_start != -1:
                code_start += 3
                code_end = ai_response.find('```', code_start)
                if code_end != -1:
                    code_content = ai_response[code_start:code_end].strip()
                    # 尝试解析代码块内容
                    result = json.loads(code_content)
                    if isinstance(result, dict) and "test_cases" in result:
                        logging.info("```代码块解析成功 - 新格式")
                        return result
                    elif isinstance(result, list):
                        logging.info("```代码块解析成功 - 旧格式")
                        return {"test_cases": result, "analysis_suggestions": ""}
        except Exception as e:
            logging.info(f"```代码块解析失败: {e}")

        # 方法4: 使用正则表达式提取JSON对象或数组
        try:
            # 首先尝试匹配包含test_cases的对象
            json_match = re.search(r'\{[\s\S]*"test_cases"[\s\S]*\}', ai_response)
            if json_match:
                result = json.loads(json_match.group())
                if isinstance(result, dict) and "test_cases" in result:
                    logging.info("正则表达式JSON对象解析成功 - 新格式")
                    return result

            # 如果没有找到对象，尝试匹配数组
            json_match = re.search(r'\[[\s\S]*\]', ai_response)
            if json_match:
                result = json.loads(json_match.group())
                if isinstance(result, list):
                    logging.info("正则表达式JSON数组解析成功 - 旧格式")
                    return {"test_cases": result, "analysis_suggestions": ""}
        except Exception as e:
            logging.info(f"正则表达式JSON解析失败: {e}")

        # 方法5: 处理截断的JSON响应 - 尝试修复不完整的JSON
        try:
            logging.info("尝试修复截断的JSON响应")
            # 尝试找到最后一个完整的JSON对象
            # 从后往前查找完整的对象结尾
            fixed_json = ai_response

            # 如果响应被截断，尝试补全
            if not fixed_json.strip().endswith('}'):
                # 查找最后一个完整的对象
                last_complete_obj = fixed_json.rfind('}')
                if last_complete_obj != -1:
                    # 移除不完整的部分，补全对象
                    fixed_json = fixed_json[:last_complete_obj + 1]
                    logging.info(f"尝试修复JSON，原长度: {len(ai_response)}, 修复后长度: {len(fixed_json)}")

                    result = json.loads(fixed_json)
                    if isinstance(result, dict) and "test_cases" in result:
                        logging.info(f"截断JSON修复成功 - 新格式，获得 {len(result.get('test_cases', []))} 个测试用例")
                        return result
                    elif isinstance(result, list):
                        logging.info(f"截断JSON修复成功 - 旧格式，获得 {len(result)} 个测试用例")
                        return {"test_cases": result, "analysis_suggestions": ""}
        except Exception as e:
            logging.info(f"截断JSON修复失败: {e}")

        # 方法6: 提取所有完整的JSON对象
        try:
            logging.info("尝试提取所有完整的JSON对象")
            # 使用正则表达式找到所有完整的JSON对象
            object_matches = re.findall(r'\{[^{}]*\}', ai_response)
            if object_matches:
                # 构建一个JSON数组
                json_array = '[' + ','.join(object_matches) + ']'
                test_cases = json.loads(json_array)
                if isinstance(test_cases, list) and len(test_cases) > 0:
                    logging.info(f"提取完整JSON对象成功，获得 {len(test_cases)} 个测试用例")
                    return {"test_cases": test_cases, "analysis_suggestions": ""}
        except Exception as e:
            logging.info(f"提取完整JSON对象失败: {e}")

        # 方法7: 使用Python的ast.literal_eval作为最后手段
        try:
            logging.info("尝试使用ast.literal_eval解析")
            # 提取看起来最像JSON数组的部分
            json_match = re.search(r'\[.*\]', ai_response, re.DOTALL)
            if json_match:
                json_content = json_match.group()
                # 尝试修复常见的JSON语法错误
                # 1. 移除尾随逗号
                json_content = re.sub(r',(\s*[}\]])', r'\1', json_content)
                # 2. 确保字符串引号正确
                json_content = re.sub(r'([{,]\s*)([a-zA-Z_][a-zA-Z0-9_]*)\s*:', r'\1"\2":', json_content)

                test_cases = ast.literal_eval(json_content)
                if isinstance(test_cases, list) and len(test_cases) > 0:
                    logging.info(f"ast.literal_eval解析成功，获得 {len(test_cases)} 个测试用例")
                    return {"test_cases": test_cases, "analysis_suggestions": ""}
        except Exception as e:
            logging.info(f"ast.literal_eval解析失败: {e}")

        # 方法8: 手动提取测试用例信息
        try:
            logging.info("尝试手动提取测试用例信息")
            test_cases = []

            # 查找所有看起来像是测试用例的对象
            case_pattern = r'\{\s*"title":\s*"([^"]*)"[^}]*\}'
            matches = re.findall(case_pattern, ai_response, re.DOTALL)

            if matches:
                for i, title in enumerate(matches):
                    test_case = {
                        "title": title,
                        "group_name": f"功能组{i+1}",
                        "maintainer": "测试人员",
                        "precondition": "系统正常运行",
                        "step_description": "请补充具体测试步骤",
                        "expected_result": "请补充预期结果",
                        "case_level": "中",
                        "case_type": "功能测试",
                        "test_suggestions": ""
                    }
                    test_cases.append(test_case)

                if test_cases:
                    logging.info(f"手动提取成功，获得 {len(test_cases)} 个基础测试用例")
                    return {"test_cases": test_cases, "analysis_suggestions": ""}
        except Exception as e:
            logging.info(f"手动提取失败: {e}")

        # 所有方法都失败
        error_msg = f"所有JSON提取方法都失败。AI响应内容: {ai_response[:500]}..."
        logging.error(error_msg)
        raise Exception(error_msg)

    except Exception as e:
        logging.error(f"块分析错误: {str(e)}")
        # 抛出异常，让上层处理
        raise Exception(f"块分析失败: {str(e)}")

def parse_json_content(json_content: str) -> List[Dict[str, Any]]:
    """解析JSON内容，支持多种容错模式"""
    print(f"[DEBUG] 进入parse_json_content，内容长度: {len(json_content)}")
    logging.info(f"进入parse_json_content，内容长度: {len(json_content)}")

    try:
        # 记录要解析的内容长度
        logging.info(f"正在解析JSON内容，长度: {len(json_content)} 字符")
        logging.info(f"JSON内容预览: {json_content[:200]}...")

        # 清理常见的前缀问题（如多余的"json"文字）
        cleaned_content = json_content.strip()
        if cleaned_content.startswith('json\n') or cleaned_content.startswith('json\r\n'):
            cleaned_content = cleaned_content[5:].strip()
            logging.info("清理了'json'前缀")

        # 尝试标准解析
        print(f"[DEBUG] 尝试标准JSON解析...")
        test_cases = json.loads(cleaned_content)
        print(f"[DEBUG] 标准JSON解析成功，获得 {len(test_cases) if isinstance(test_cases, list) else 0} 个测试用例")
        logging.info(f"标准JSON解析成功，获得 {len(test_cases) if isinstance(test_cases, list) else 0} 个测试用例")
        return test_cases if isinstance(test_cases, list) else []
    except json.JSONDecodeError as e:
        print(f"[DEBUG] 标准JSON解析失败: {e}")
        logging.warning(f"标准JSON解析失败: {e}")
        logging.info(f"失败的JSON内容前200字符: {json_content[:200]}...")

        # 尝试非严格模式
        print(f"[DEBUG] 尝试非严格JSON解析...")
        try:
            test_cases = json.loads(cleaned_content, strict=False)
            print(f"[DEBUG] 非严格JSON解析成功，获得 {len(test_cases) if isinstance(test_cases, list) else 0} 个测试用例")
            logging.info(f"非严格JSON解析成功，获得 {len(test_cases) if isinstance(test_cases, list) else 0} 个测试用例")
            return test_cases if isinstance(test_cases, list) else []
        except Exception as e2:
            print(f"[DEBUG] 非严格JSON解析失败: {e2}")
            logging.warning(f"非严格JSON解析失败: {e2}")

            # 尝试修复常见的JSON问题
            print(f"[DEBUG] 尝试JSON修复解析...")
            try:
                # 修复未转义的换行符
                fixed_content = cleaned_content.replace('\n', '\\n').replace('\r', '\\r')
                test_cases = json.loads(fixed_content, strict=False)
                print(f"[DEBUG] JSON修复解析成功，获得 {len(test_cases) if isinstance(test_cases, list) else 0} 个测试用例")
                logging.info(f"JSON修复解析成功，获得 {len(test_cases) if isinstance(test_cases, list) else 0} 个测试用例")
                return test_cases if isinstance(test_cases, list) else []
            except Exception as e3:
                print(f"[DEBUG] JSON修复解析失败: {e3}")
                logging.error(f"JSON修复解析失败: {e3}")
                logging.error(f"最终失败的JSON内容: {cleaned_content[:500]}...")
                return []

def deduplicate_test_cases(test_cases: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """测试用例去重和优化"""
    seen_titles = set()
    unique_cases = []

    for case in test_cases:
        if not isinstance(case, dict):
            continue

        title = case.get("title", "").strip()
        if not title or title in seen_titles:
            continue

        seen_titles.add(title)

        # 标准化测试用例格式
        standardized_case = {
            "title": title,
            "group_name": case.get("group_name", "默认组").strip() or "默认组",
            "maintainer": case.get("maintainer", "测试人员").strip() or "测试人员",
            "precondition": case.get("precondition", "无").strip() or "无",
            "step_description": case.get("step_description", "请补充测试步骤").strip() or "请补充测试步骤",
            "expected_result": case.get("expected_result", "请补充预期结果").strip() or "请补充预期结果",
            "case_level": case.get("case_level", "中").strip() or "中",
            "case_type": case.get("case_type", "功能测试").strip() or "功能测试",
            "test_suggestions": case.get("test_suggestions", "").strip() or ""
        }

        unique_cases.append(standardized_case)

    return unique_cases

async def analyze_with_ai(content: str, ai_config: AIConfiguration) -> List[Dict[str, Any]]:
    """
    使用AI分析文档内容并生成符合Excel模板格式的测试用例
    """
    try:
        # 构建提示词 - 适配Excel模板格式
        prompt = f"""
请详细分析以下产品需求文档(PRD)，并生成符合Excel模板格式的全面、详细的测试用例。

文档内容：
{content}

请按照以下格式返回JSON数组，每个测试用例包含以下字段：

```json
[
  {{
    "title": "测试用例标题（*必填）",
    "group_name": "所属分组（选填，用|分隔层级，如：Web端测试用例|首页|我的待办）",
    "maintainer": "维护人（选填，成员姓名）",
    "precondition": "前置条件（选填，执行测试前的必要条件）",
    "step_description": "步骤描述（选填，使用【1】、【2】等编号格式，每个步骤一行）",
    "expected_result": "预期结果（选填，每个步骤对应的预期结果，与步骤编号对应）",
    "case_level": "用例等级（选填：高/中/低，默认：中）",
    "case_type": "用例类型（选填：功能测试/性能测试/安全测试/兼容性测试，默认：功能测试）"
  }}
]
```

**重要要求**（严格按照Excel模板格式）：

1. **测试用例生成**（遵循Teambition导入规范）：
   - 针对文档内容生成详细的测试用例
   - 测试用例必须覆盖所有功能点、业务场景、边界条件和异常情况
   - 包括但不限于：正常流程、异常流程、边界值、数据验证、权限控制等
   - **步骤描述格式**：必须使用【1】、【2】、【3】等中文编号格式，每个步骤单独一行
   - **预期结果格式**：与步骤描述对应，使用相同的【1】、【2】、【3】编号格式
   - **分组格式**：使用"|"分隔层级，如"Web端测试用例|首页|我的待办"
   - **必填规则**：只有"title"是必填项，其他字段选填但建议尽可能完整
   - 区分不同优先级：核心业务（高）、主要功能（中）、非核心功能（低）
   - 包含多种测试类型：功能测试、性能测试、安全测试、兼容性测试等
   - 如果文档有多个功能模块，每个模块都要有对应的测试用例
   - 考虑用户操作的各种可能性和错误场景

2. **格式规范**：
   - 确保生成的JSON格式完全正确
   - 所有字段都必须有值，不能有空值或缺失字段（选填字段可以为空字符串）
   - 步骤描述和预期结果必须使用【1】、【2】、【3】的中文编号格式
   - 分组名称使用"|"分隔多个层级
   - 参考示例格式：
     ```
     步骤描述：
     【1】用户点击登录按钮
     【2】系统跳转到登录页面
     【3】用户输入正确的用户名和密码

     预期结果：
     【1】登录按钮可正常点击
     【2】成功跳转到登录页面
     【3】用户能够成功登录系统
     ```

请直接返回JSON数组，不要包含其他文本。确保JSON格式正确且无语法错误。
        """
        
        # 构建请求数据
        request_data = {
            "model": ai_config.model_name,
            "messages": [
                {
                    "role": "user",
                    "content": prompt
                }
            ],
            "temperature": 0.7,
            "max_tokens": 4000
        }
        
        # 设置请求头
        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {ai_config.api_key}"
        }
        
        # 发送API请求
        async with httpx.AsyncClient(timeout=60.0) as client:
            response = await client.post(
                ai_config.api_endpoint + "/chat/completions",
                json=request_data,
                headers=headers
            )
        
        if response.status_code != 200:
            raise Exception(f"AI API请求失败: {response.status_code} - {response.text}")
        
        result = response.json()
        
        # 提取AI返回的内容
        if "choices" not in result or not result["choices"]:
            raise Exception("AI返回结果格式错误")
        
        ai_response = result["choices"][0]["message"]["content"].strip()

        # 记录AI响应的详细信息用于调试
        logging.info(f"AI响应内容预览: {ai_response[:500]}...")
        logging.info(f"AI响应完整长度: {len(ai_response)} 字符")
        logging.info(f"AI响应前50字符: {repr(ai_response[:50])}")
        logging.info(f"AI响应后50字符: {repr(ai_response[-50:])}")

        # 解析JSON响应
        try:
            # 尝试直接解析
            test_cases = json.loads(ai_response)
            logging.info("直接JSON解析成功")
        except json.JSONDecodeError as e:
            logging.info(f"直接JSON解析失败: {e}，开始尝试提取JSON数据")
            # 如果直接解析失败，尝试提取JSON部分
            try:
                # 首先尝试匹配```json...```格式的代码块
                logging.info("尝试匹配```json...```格式")
                json_block_match = re.search(r'```json\s*\n?(.*?)\s*```', ai_response, re.DOTALL)
                if json_block_match:
                    json_content = json_block_match.group(1).strip()
                    logging.info(f"找到```json代码块，内容长度: {len(json_content)}")
                    test_cases = json.loads(json_content)
                    logging.info("```json代码块解析成功")
                else:
                    logging.info("未找到```json...```格式")
                    # 尝试更简单的匹配模式
                    simple_json_match = re.search(r'```json(.*?)```', ai_response, re.DOTALL)
                    if simple_json_match:
                        json_content = simple_json_match.group(1).strip()
                        logging.info(f"找到简单```json代码块，内容长度: {len(json_content)}")
                        test_cases = json.loads(json_content)
                        logging.info("简单```json代码块解析成功")
                    else:
                        logging.info("未找到简单```json代码块，尝试匹配不带json标记的代码块")
                    # 尝试匹配不带json标记的代码块
                    code_block_match = re.search(r'```\s*\n?(.*?)\s*```', ai_response, re.DOTALL)
                    if code_block_match:
                        json_content = code_block_match.group(1).strip()
                        logging.info(f"找到```代码块，内容预览: {json_content[:100]}...")
                        # 检查是否是有效的JSON数组
                        if json_content.startswith('[') and json_content.endswith(']'):
                            test_cases = json.loads(json_content)
                            logging.info("```代码块解析成功")
                        else:
                            raise Exception("代码块内容不是JSON数组格式")
                    else:
                        logging.info("未找到```...```格式，尝试直接匹配JSON数组")
                        # 尝试直接匹配JSON数组
                        json_match = re.search(r'\[.*\]', ai_response, re.DOTALL)
                        if json_match:
                            json_content = json_match.group()
                            logging.info(f"找到JSON数组，内容长度: {len(json_content)}")
                            test_cases = json.loads(json_content)
                            logging.info("JSON数组解析成功")
                        else:
                            raise Exception("无法从响应中提取JSON数据")
            except Exception as e:
                # 如果仍然失败，抛出异常而不是返回默认测试用例
                error_msg = f"AI响应格式错误，无法提取有效的JSON数据: {str(e)}。AI响应内容: {ai_response[:200]}..."
                logging.error(error_msg)
                raise Exception(error_msg)
        
        # 检查返回格式是否是包含test_cases的字典
        if isinstance(test_cases, dict) and "test_cases" in test_cases:
            # 新的返回格式
            result = {
                "test_cases": [],
                "analysis_suggestions": test_cases.get("analysis_suggestions", "")
            }

            # 确保每个测试用例都有必要的字段
            for case in test_cases["test_cases"]:
                if isinstance(case, dict) and "title" in case:
                    validated_case = {
                        "title": case.get("title", "未命名测试用例"),
                        "group_name": case.get("group_name", "默认组"),
                        "maintainer": case.get("maintainer", "测试人员"),
                        "precondition": case.get("precondition", "无"),
                        "step_description": case.get("step_description", "请补充测试步骤"),
                        "expected_result": case.get("expected_result", "请补充预期结果"),
                        "case_level": case.get("case_level", "中"),
                        "case_type": case.get("case_type", "功能测试"),
                        "test_suggestions": case.get("test_suggestions", "")
                    }
                    result["test_cases"].append(validated_case)

            if not result["test_cases"]:
                raise Exception("AI生成的测试用例列表为空或格式不正确")

            return result

        elif isinstance(test_cases, list):
            # 兼容旧的返回格式
            result = {
                "test_cases": [],
                "analysis_suggestions": ""
            }

            for case in test_cases:
                if isinstance(case, dict) and "title" in case:
                    validated_case = {
                        "title": case.get("title", "未命名测试用例"),
                        "group_name": case.get("group_name", "默认组"),
                        "maintainer": case.get("maintainer", "测试人员"),
                        "precondition": case.get("precondition", "无"),
                        "step_description": case.get("step_description", "请补充测试步骤"),
                        "expected_result": case.get("expected_result", "请补充预期结果"),
                        "case_level": case.get("case_level", "中"),
                        "case_type": case.get("case_type", "功能测试"),
                        "test_suggestions": case.get("test_suggestions", "")
                    }
                    result["test_cases"].append(validated_case)

            if not result["test_cases"]:
                raise Exception("AI生成的测试用例列表为空或格式不正确")

            return result
        else:
            raise Exception(f"AI返回的数据格式错误，期望是字典或列表，实际得到: {type(test_cases)}")
    
    except Exception as e:
        logging.error(f"AI分析错误: {str(e)}")
        # 直接抛出异常，不返回默认测试用例
        raise Exception(f"AI分析失败: {str(e)}")

